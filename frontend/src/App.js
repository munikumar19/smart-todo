import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './App.css';
import AuthForm from './AuthForm'; // New component for login/register

// Component to display the calculated metrics
const ProductivitySnapshot = ({ metrics }) => (
  <div className="snapshot-container">
    <h2>Productivity Snapshot</h2>
    <div className="snapshot-grid">
      <div className="snapshot-card">
        <h4>Total Tasks</h4>
        <p>{metrics.total}</p>
      </div>
      <div className="snapshot-card">
        <h4>Completed</h4>
        <p>{metrics.completed}</p>
      </div>
      <div className="snapshot-card">
        <h4>Pending</h4>
        <p>{metrics.pending}</p>
      </div>
      <div className="snapshot-card">
        <h4>Completion Rate</h4>
        <p>{metrics.rate}</p>
      </div>
    </div>
  </div>
);

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [theme, setTheme] = useState('light');
  
  const [userToken, setUserToken] = useState(localStorage.getItem('token')); 
  
  // --- VIEW & FILTER STATE ---
  const [currentView, setCurrentView] = useState('main'); // 'main' or 'recycle_bin'
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterCompleted, setFilterCompleted] = useState('All');
  const [searchQuery, setSearchQuery] = useState(''); 
  const [isLoadingTasks, setIsLoadingTasks] = useState(false); 

  
  // Define the base URL used by all API calls
  const BASE_API_DOMAIN = 'https://smart-todo-r8nl.onrender.com/api'; 

  // FIX: Use useMemo to ensure authAxios is only recreated when userToken changes, stabilizing the dependency chain.
  const authAxios = useMemo(() => axios.create({
    baseURL: BASE_API_DOMAIN,
    headers: {
      'x-auth-token': userToken,
    },
  }), [userToken]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId'); 
    setUserToken(null);
    setTasks([]); 
  };

  const fetchTasks = useCallback(async () => {
    if (!userToken) return;

    setIsLoadingTasks(true); 

    // Construct query parameters for filtering
    const params = new URLSearchParams();
    
    if (currentView === 'recycle_bin') {
        params.append('view', 'recycle_bin');
    } else {
        if (filterPriority !== 'All') {
          params.append('priority', filterPriority);
        }
        if (filterCompleted !== 'All') {
          params.append('completed', filterCompleted === 'Completed' ? 'true' : 'false'); 
        }
    }
    
    try {
      const response = await authAxios.get(`/tasks?${params.toString()}`);
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      if (error.response && error.response.status === 401) {
        handleLogout();
      }
      setTasks([]);
    } finally {
        setIsLoadingTasks(false);
    }
  }, [userToken, authAxios, filterPriority, filterCompleted, currentView]); // Added currentView dependency

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAuthSuccess = (token, id) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', id);
    setUserToken(token);
    
    const tempAuthAxios = axios.create({
        baseURL: 'http://localhost:5000/api',
        headers: { 'x-auth-token': token },
    });
    
    tempAuthAxios.get('/tasks')
      .then(res => setTasks(res.data))
      .catch(err => console.error("Post-login fetch failed:", err));
  };


  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await authAxios.post('/tasks', {
        title: newTaskTitle,
        description: newTaskDescription,
        priority: newTaskPriority,
      });
      fetchTasks();
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('Medium');
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  // SOFT DELETE (Archive) function - CHANGED TO PATCH METHOD FOR CLARITY
  const handleArchiveTask = async (id) => {
    try {
      // Use PATCH to set isArchived: true (Soft Delete)
      await authAxios.patch(`/tasks/${id}`, { isArchived: true });
      fetchTasks();
    } catch (error) {
      console.error("Error archiving task:", error);
    }
  };

  // FIXED: Toggle completed status ONLY. No automatic archiving.
  const handleToggleCompleted = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      // 1. Just update the completed status
      await authAxios.patch(`/tasks/${id}`, {
        completed: newStatus,
      });
      
      // 2. Do NOT archive automatically here. 
      // The user must click the separate 'Delete' (Archive) button.
      
      fetchTasks(); // Re-fetch the list to update and apply sorting
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  // NEW: Restore function (No Change)
  const handleRestoreTask = async (id) => {
      try {
          // PATCH route updates isArchived back to false
          await authAxios.patch(`/tasks/${id}`, { isArchived: false });
          fetchTasks(); // Reload the current view (Recycle Bin)
      } catch (error) {
          console.error("Error restoring task:", error);
      }
  };

  // NEW: Permanent Delete function (No Change)
  const handlePermanentDelete = async (id) => {
      try {
          // Send query parameter to force permanent deletion
          await authAxios.delete(`/tasks/${id}?permanent=true`);
          fetchTasks(); // Reload the current view (Recycle Bin)
      } catch (error) {
          console.error("Error deleting task permanently:", error);
      }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const snapshotMetrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const rate = total > 0 ? `${((completed / total) * 100).toFixed(1)}%` : '0%';

    return { total, completed, pending, rate };
  }, [tasks]);
  
  // --- Conditional Rendering: Auth Check (Login/Register View) ---
  if (!userToken) {
    return (
        <div className={`App ${theme}`}>
            <button onClick={toggleTheme} className="theme-toggle-button">
                {theme === 'light' ? '🌞 Dark' : '🌛 Light'} Mode
            </button>
            <h1 className="auth-header-title">My Smart To-Do List</h1>
            <p className="auth-quote">
                <span className="quote-text">"The secret of getting ahead is getting started."</span>
            </p>
            <AuthForm 
                onAuthSuccess={handleAuthSuccess} 
                toggleTheme={toggleTheme}
                currentTheme={theme}
            />
        </div>
    );
  }

  // --- Main Application UI (Rendered when authenticated) ---
  return (
    <div className={`App ${theme}`}>
      {/* Action Buttons: Positioned by CSS */}
      <button onClick={handleLogout} className="logout-button">
        Logout
      </button>
      <button onClick={toggleTheme} className="theme-toggle-button">
        {theme === 'light' ? '🌞 Dark' : '🌛 Light'} Mode
      </button>
      
      <h1>{currentView === 'main' ? 'Smart To-Do List' : 'Recycle Bin (Archived Tasks)'}</h1>

      {currentView === 'main' && (
        <>
            {/* --- Filter Bar & Search --- */}
            <div className="filter-bar">
                <label>Filter Priority:</label>
                <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>

                <label>Status:</label>
                <select value={filterCompleted} onChange={(e) => setFilterCompleted(e.target.value)}>
                    <option value="All">All Statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                </select>
                <button className="show-filter-button" onClick={fetchTasks} disabled={isLoadingTasks}>
                    Show
                </button>
                <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>
            {/* --- End Filter Bar --- */}

            {/* --- Add Task Form --- */}
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
                <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                </select>
                <button type="submit">Add Task</button>
            </form>
        </>
      )}
      
      <div className="task-list">
        <h2>{currentView === 'main' ? 'My Tasks' : 'Archived Tasks'}</h2>
        {isLoadingTasks ? (
            <p>Loading tasks...</p>
        ) : filteredTasks.length > 0 ? (
          <ul>
            {filteredTasks.map((task) => (
              <li key={task._id} className={task.completed ? 'completed' : ''}>
                <div className="task-info">
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                </div>
                
                {currentView === 'main' ? (
                    <div className="task-actions">
                        <span className={`priority-tag ${(task.priority || 'Medium').toLowerCase()}`}>
                            {task.priority || 'Medium'}
                        </span>
                        <button
                            onClick={() => handleToggleCompleted(task._id, task.completed)}
                        >
                            {task.completed ? 'Undo' : 'Complete'}
                        </button>
                        {/* MAIN VIEW: Delete button triggers Soft Delete (Archive) */}
                        <button onClick={() => handleArchiveTask(task._id)}>Delete</button> 
                    </div>
                ) : (
                    <div className="task-actions recycle-actions">
                        {/* RECYCLE BIN VIEW: Restore and Permanent Delete buttons */}
                        <button onClick={() => handleRestoreTask(task._id)} className="restore-button">
                            Restore
                        </button>
                        <button onClick={() => handlePermanentDelete(task._id)} className="permanent-delete-button">
                            Permanently Delete
                        </button>
                    </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{currentView === 'main' ? 'No tasks match the current search or filters.' : 'Your Recycle Bin is empty.'}</p>
        )}
      </div>
      
      {/* --- Snapshot Display (Moved HERE: Between list and toggle button) --- */}
      <ProductivitySnapshot metrics={snapshotMetrics} />
      
      {/* --- View Toggle Button (Now comes last) --- */}
      <button 
        className="recycle-bin-toggle" 
        onClick={() => setCurrentView(currentView === 'main' ? 'recycle_bin' : 'main')}
      >
        {currentView === 'main' ? '🗑️ Recycle Bin' : '⬅️ Back to Tasks'}
      </button>
    <p className="copyright-footer">
        &copy; {new Date().getFullYear()} My Smart To-Do List. All rights reserved.
      </p>
    </div>
  );
};

export default App;
