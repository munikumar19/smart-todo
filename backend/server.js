const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'your_super_secret_key'; 

// Middleware
app.use(cors());
app.use(express.json());

// --- CRITICAL DEPLOYMENT FIX: Direct Fallback to Verified Atlas URI ---
// We embed the verified URI directly as a fallback. 
// NOTE: Use munikumar25:smarttodo123 for the connection credentials.
const ATLAS_URI_FALLBACK = 'mongodb+srv://munikumar25:smarttodo123@cluster0.jaxxykj.mongodb.net/smart-todo-prod?retryWrites=true&w=majority&authSource=admin';

// Priority: Use environment variable first (MONGO_URI), then the verified fallback.
const MONGODB_URI = process.env.MONGO_URI || ATLAS_URI_FALLBACK;

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.log('MongoDB connection error:', err));
// --- END FIX ---

// --- Schemas and Models ---

// 1. User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// 2. Task Schema
const taskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    completed: { type: Boolean, default: false },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    isArchived: { type: Boolean, default: false },
    dueDate: { type: Date } 
});

const Task = mongoose.model('Task', taskSchema);

// --- Auth Middleware (No Change) ---

const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (e) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// --- Authentication Routes (No Change) ---

// REGISTER User
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({ email, password });
        await user.save();

        const payload = { userId: user.id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// LOGIN User
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const payload = { userId: user.id };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// --- Protected Task Routes (No Change) ---

// 1. GET all tasks for the authenticated user
app.get('/api/tasks', auth, async (req, res) => {
    try {
        const { priority, completed, view } = req.query;
        
        const matchQuery = { userId: new mongoose.Types.ObjectId(req.userId) };

        if (view === 'recycle_bin') {
            matchQuery.isArchived = true;
        } else {
            matchQuery.isArchived = false;
        }

        if (view !== 'recycle_bin') {
            if (priority && priority !== 'All') {
                matchQuery.priority = priority;
            }
            if (completed !== undefined && completed !== 'All') {
                matchQuery.completed = completed === 'true'; 
            }
        }

        const tasks = await Task.aggregate([
            { $match: matchQuery }, 
            {
                $addFields: {
                    priorityOrder: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$priority', 'High'] }, then: 1 },
                                { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
                            ],
                            default: 3
                        }
                    }
                }
            },
            { $sort: { completed: 1, priorityOrder: 1, createdAt: -1 } } 
        ]);
        res.json(tasks);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: err.message });
    }
});

// 2. POST a new task
app.post('/api/tasks', auth, async (req, res) => {
    const task = new Task({
        userId: req.userId,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || 'Medium',
        dueDate: req.body.dueDate || null,
    });
    try {
        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 3. UPDATE a task
app.patch('/api/tasks/:id', auth, async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
        if (!task) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        
        if (req.body.completed !== undefined) {
            task.completed = req.body.completed;
            task.completedAt = req.body.completed ? new Date() : null; 
        }
        
        if (req.body.priority) {
            task.priority = req.body.priority;
        }

        if (req.body.isArchived !== undefined) {
             task.isArchived = req.body.isArchived;
        }

        if (req.body.dueDate !== undefined) {
             task.dueDate = req.body.dueDate; 
        }

        const updatedTask = await task.save();
        res.json(updatedTask);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 4. DELETE a task
app.delete('/api/tasks/:id', auth, async (req, res) => {
    const { permanent } = req.query; 

    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
        if (!task) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        
        if (permanent === 'true' || task.isArchived) {
            await task.deleteOne();
            return res.json({ message: 'Task permanently deleted' });
        } else {
            task.isArchived = true;
            await task.save();
            return res.json({ message: 'Task archived to recycle bin' });
        }

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
