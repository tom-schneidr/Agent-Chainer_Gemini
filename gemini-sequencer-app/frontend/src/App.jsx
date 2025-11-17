import React, { useState } from 'react';
import Sequencer from './components/Sequencer';
import Chat from './components/Chat';
import './App.css'; // Main app styles (already provided in index.css)

const TABS = {
  SEQUENCER: 'Sequencer',
  PRO_CHAT: 'Gemini 2.5 Pro Chat',
  FLASH_CHAT: 'Gemini 2.5 Flash Chat',
};

function App() {
  const [activeTab, setActiveTab] = useState(TABS.SEQUENCER);

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.PRO_CHAT:
        return <Chat model="gemini-2.5-pro" key="pro" />;
      case TABS.FLASH_CHAT:
        return <Chat model="gemini-2.5-flash" key="flash" />;
      case TABS.SEQUENCER:
      default:
        return <Sequencer />;
    }
  };

  return (
    <div className="app-container">
      <header className="tabs">
        <button
          className={`tab-button ${activeTab === TABS.SEQUENCER ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.SEQUENCER)}
        >
          {TABS.SEQUENCER}
        </button>
        <button
          className={`tab-button ${activeTab === TABS.PRO_CHAT ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.PRO_CHAT)}
        >
          {TABS.PRO_CHAT}
        </button>
        <button
          className={`tab-button ${activeTab === TABS.FLASH_CHAT ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.FLASH_CHAT)}
        >
          {TABS.FLASH_CHAT}
        </button>
      </header>
      <main className="tab-content">
        {renderTabContent()}
      </main>
    </div>
  );
}

export default App;