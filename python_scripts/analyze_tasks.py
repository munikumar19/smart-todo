import pandas as pd
from pymongo import MongoClient
import datetime

# MongoDB connection details
MONGODB_URI = 'mongodb://localhost:27017/'
DATABASE_NAME = 'smart-todo'
COLLECTION_NAME = 'tasks'

def analyze_tasks():
    """
    Connects to MongoDB, retrieves task data, and performs a detailed analysis.
    """
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        collection = db[COLLECTION_NAME]

        # Fetch all tasks from the database
        tasks = list(collection.find())

        # Convert tasks to a Pandas DataFrame
        if not tasks:
            print("No tasks found in the database. Add some tasks and try again.")
            return

        df = pd.DataFrame(tasks)

        # --- Analysis ---
        print("--- Smart To-Do List Analysis ---")

        # 1. Total tasks and completion rate
        total_tasks = len(df)
        completed_tasks = df[df['completed']].shape[0]
        incomplete_tasks = total_tasks - completed_tasks

        print(f"Total tasks created: {total_tasks}")
        print(f"Tasks completed: {completed_tasks}")
        print(f"Tasks pending: {incomplete_tasks}")

        if total_tasks > 0:
            completion_rate = (completed_tasks / total_tasks) * 100
            print(f"Completion rate: {completion_rate:.2f}%")

        # 2. Analyze productivity by day of the week
        print("\n--- Productivity by Day of the Week ---")
        # Ensure createdAt is in datetime format
        df['createdAt'] = pd.to_datetime(df['createdAt'])
        df['day_of_week'] = df['createdAt'].dt.day_name()

        # Count tasks created on each day
        tasks_by_day = df['day_of_week'].value_counts()
        print(tasks_by_day)

        # 3. Analyze task completion time (if you added a completion timestamp)
        # NOTE: This requires a new field in your database. For now, it's a concept.
        # Example:
        # df['completion_time'] = pd.to_datetime(df['completion_timestamp'])
        # df['time_to_complete'] = (df['completion_time'] - df['createdAt']).dt.total_seconds() / 60 # in minutes
        # print(f"\nAverage time to complete a task: {df['time_to_complete'].mean():.2f} minutes")

        print("\n--- Sample of Your Task Data ---")
        print(df[['title', 'completed', 'day_of_week']].head())

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    analyze_tasks()