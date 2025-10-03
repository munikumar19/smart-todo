import React, { useState } from 'react';
import axios from 'axios';

const Insights = () => {
    const [insights, setInsights] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchInsights = async () => {
        setIsLoading(true);
        setError(null);
        setInsights(null);

        try {
            // The backend /api/insights endpoint executes the Python script
            const response = await axios.get('http://localhost:5000/api/insights');
            
            // The response data is a JSON string from the Python script, so we must parse it
            const parsedData = JSON.parse(response.data);
            
            if (parsedData.status === 'critical_error') {
                setError(`Python Error: ${parsedData.message}`);
            } else {
                setInsights(parsedData);
            }
        } catch (err) {
            console.error("Error fetching or parsing insights:", err);
            setError("Could not connect to or parse data from the Python analysis script.");
        }
        setIsLoading(false);
    };

    const InsightCard = ({ title, value }) => (
        <div className="insight-card">
            <h4>{title}</h4>
            <p>{value}</p>
        </div>
    );

    return (
        <div className="insights-container">
            <h2>Productivity Insights</h2>
            <button onClick={fetchInsights} disabled={isLoading}>
                {isLoading ? 'Loading Analysis...' : 'Generate New Insights'}
            </button>
            
            {error && (
                <div className="error-message">
                    <p>Error: {error}</p>
                    <p>Ensure your MongoDB and Python script are running correctly.</p>
                </div>
            )}

            {insights && (
                <div className="insights-content">
                    
                    <div className="insights-grid">
                        <InsightCard 
                            title="Total Tasks Created" 
                            value={insights.total_tasks || 0} 
                        />
                        <InsightCard 
                            title="Completion Rate" 
                            value={insights.completion_rate || "0.00%"} 
                        />
                        <InsightCard 
                            title="Tasks Completed" 
                            value={insights.completed_count || 0} 
                        />
                        <InsightCard 
                            title="Avg. Time to Complete" 
                            value={insights.avg_completion_time || "N/A"} 
                        />
                    </div>
                    
                    {/* Display raw data for Tasks by Day Analysis */}
                    <div className="raw-analysis">
                        <h3>Tasks Created by Day</h3>
                        <pre>{insights.tasks_by_day_raw || "Data not available."}</pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Insights;