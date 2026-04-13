import { ActivityLogProvider } from './context/ActivityLogContext';
import './index.css'; // Keep global styles

function App() {
  return (
    <ActivityLogProvider>
      <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-8">CTP500 Printer Web (React)</h1>
        {/* Future components will go here */}
      </div>
    </ActivityLogProvider>
  );
}

export default App;