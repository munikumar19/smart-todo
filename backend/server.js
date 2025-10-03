// server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = 'mongodb://localhost:27017/smart-todo';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.log('MongoDB connection error:', err));

// Define the Task Schema and Model
const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    completed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Task = mongoose.model('Task', taskSchema);

// API Routes

// 1. GET all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. POST a new task
app.post('/api/tasks', async (req, res) => {
    const task = new Task({
        title: req.body.title,
        description: req.body.description
    });
    try {
        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 3. UPDATE a task (e.g., mark as completed)
app.patch('/api/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        task.completed = req.body.completed;
        const updatedTask = await task.save();
        res.json(updatedTask);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 4. DELETE a task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        await task.deleteOne();
        res.json({ message: 'Task deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add this new route to your server.js file
const { spawn } = require('child_process');

// 5. GET analysis from Python script
app.get('/api/insights', (req, res) => {
    // 'spawn' is used to run external commands like a Python script
    const pythonProcess = spawn('python', ['../python_scripts/analyze_tasks.py']);

    let scriptOutput = '';

    // Capture output from the Python script
    pythonProcess.stdout.on('data', (data) => {
        scriptOutput += data.toString();
    });

    // Handle errors
    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    // Send the output back to the frontend when the script finishes
    pythonProcess.on('close', (code) => {
        console.log(`Python script exited with code ${code}`);
        res.status(200).send(scriptOutput);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});