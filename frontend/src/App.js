import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Insights from './Insights'; // Correctly imported

const App = () => {
const [tasks, setTasks] = useState([]);
const [newTaskTitle, setNewTaskTitle] = useState('');
const [newTaskDescription, setNewTaskDescription] = useState('');

const API_URL = 'http://localhost:5000/api/tasks';

// Function to fetch tasks from the backend
const fetchTasks = async () => {
   try {
      const response = await axios.get(API_URL);
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  // Fetch tasks when the component mounts
  useEffect(() => {
    fetchTasks();
  }, []);

  // Function to handle adding a new task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return; // Prevent adding empty tasks
    try {
      const response = await axios.post(API_URL, {
        title: newTaskTitle,
        description: newTaskDescription,
      });
      setTasks([...tasks, response.data]);
      setNewTaskTitle('');
      setNewTaskDescription('');
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  // Function to handle marking a task as completed
  const handleToggleCompleted = async (id, currentStatus) => {
    try {
      const response = await axios.patch(`${API_URL}/${id}`, {
        completed: !currentStatus
      });
      setTasks(tasks.map(task => 
        task._id === id ? response.data : task
      ));
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  // Function to handle deleting a task
  const handleDeleteTask = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      setTasks(tasks.filter(task => task._id !== id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="App">
      <h1>Smart To-Do List</h1>
      <form onSubmit={handleAddTask}>
        <input
          type="text"
          placeholder="Task title"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Task description (optional)"
          value={newTaskDescription}
          onChange={(e) => setNewTaskDescription(e.target.value)}
        />
        <button type="submit">Add Task</button>
      </form>

      <div className="task-list">
        <h2>My Tasks</h2>
        {tasks.length > 0 ? (
          <ul>
            {tasks.map(task => (
              <li key={task._id} className={task.completed ? 'completed' : ''}>
                <div className="task-info">
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                </div>
                <div className="task-actions">
                  <button onClick={() => handleToggleCompleted(task._id, task.completed)}>
                    {task.completed ? 'Undo' : 'Complete'}
                  </button>
                  <button onClick={() => handleDeleteTask(task._id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No tasks yet. Add one above!</p>
        )}
      </div>
      <Insights /> {/* Add this line */}
    </div>
  );
};

export default App;