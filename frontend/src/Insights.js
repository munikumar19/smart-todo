import React, { useState } from 'react';
import axios from 'axios';

const Insights = () => {
    const [insights, setInsights] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchInsights = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('http://localhost:5000/api/insights');
            setInsights(response.data);
        } catch (error) {
            console.error("Error fetching insights:", error);
            setInsights("Error loading insights.");
        }
        setIsLoading(false);
    };

    return (
        <div className="insights-container">
            <h2>Productivity Insights</h2>
            <button onClick={fetchInsights} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Get Insights'}
            </button>
            {insights && (
                <pre>{insights}</pre> // <pre> tag preserves formatting
            )}
        </div>
    );
};

export default Insights;