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

// Change this line to read an environment variable for security
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-todo'; 
// Note: When deploying, you will set MONGO_URI on Render.

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.log('MongoDB connection error:', err));

// --- Schemas and Models ---

// 1. User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// 2. Task Schema (UPDATED for isArchived)
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
    isArchived: { type: Boolean, default: false } // NEW: Soft Delete Field
});

const Task = mongoose.model('Task', taskSchema);

// --- Auth Middleware ---

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

// --- Protected Task Routes (Updated for Archive/Recycle Bin) ---

// 1. GET all tasks for the authenticated user
app.get('/api/tasks', auth, async (req, res) => {
    try {
        const { priority, completed, view } = req.query; // Added 'view' parameter
        
        const matchQuery = { userId: new mongoose.Types.ObjectId(req.userId) };

        // Determine if we are viewing the main list or the recycle bin
        if (view === 'recycle_bin') {
            matchQuery.isArchived = true;
        } else {
            matchQuery.isArchived = false; // Default: show non-archived tasks
        }

        // Add optional filters from query parameters (only applies to main list)
        if (view !== 'recycle_bin') {
            if (priority && priority !== 'All') {
                matchQuery.priority = priority;
            }
            if (completed !== undefined && completed !== 'All') {
                matchQuery.completed = completed === 'true'; 
            }
        }

        // 3. Build the aggregation pipeline with dynamic matching and sorting
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
            // Sort: incomplete first, then priority (High=1), then newest first
            { $sort: { completed: 1, priorityOrder: 1, createdAt: -1 } } 
        ]);
        res.json(tasks);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: err.message });
    }
});

// 2. POST a new task (No Change)
app.post('/api/tasks', auth, async (req, res) => {
    const task = new Task({
        userId: req.userId,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || 'Medium',
    });
    try {
        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 3. UPDATE a task (now handles completion time AND restoration)
app.patch('/api/tasks/:id', auth, async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
        if (!task) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        
        if (req.body.completed !== undefined) {
            task.completed = req.body.completed;
            task.completedAt = req.body.completed ? new Date() : null; // Set/clear timestamp
        }
        
        if (req.body.priority) {
            task.priority = req.body.priority;
        }

        if (req.body.isArchived !== undefined) {
             task.isArchived = req.body.isArchived;
        }

        const updatedTask = await task.save();
        res.json(updatedTask);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 4. SOFT DELETE (Archive) or PERMANENT DELETE a task
app.delete('/api/tasks/:id', auth, async (req, res) => {
    const { permanent } = req.query; // Check if permanent deletion is requested

    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
        if (!task) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        
        if (permanent === 'true' || task.isArchived) {
            // PERMANENT DELETE (used in Recycle Bin)
            await task.deleteOne();
            return res.json({ message: 'Task permanently deleted' });
        } else {
            // SOFT DELETE (Archive from main list)
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