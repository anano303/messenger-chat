"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import styles from './MessengerChat.module.css';
import { messengerConfig } from '../lib/env';

interface MessengerChatProps {
  pageId?: string;
  appId?: string;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  isAdmin?: boolean;
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
}

interface GuestInfo {
  name: string;
  userId: string;
  selectedChannel: 'facebook' | 'guest';
  lastMessageTimestamp: number;
}

const MessengerChat: React.FC<MessengerChatProps> = ({ 
  pageId = messengerConfig.pageId,
  appId = messengerConfig.appId 
}) => {
  // State for chat UI
  const [chatState, setChatState] = useState<'closed' | 'minimized' | 'open'>('closed');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [lastTimestamp, setLastTimestamp] = useState<number>(0);
  
  // Guest user info
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [guestName, setGuestName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showChannelChoice, setShowChannelChoice] = useState(false);
  
  // Refs for various functionality
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const messageIdsRef = useRef<Set<string>>(new Set());

  // ============================
  // ===== Helper Functions =====
  // ============================

  // Save guest info
  const saveGuestInfo = (info: Partial<GuestInfo>) => {
    const currentInfo = localStorage.getItem('guest_info');
    const parsedInfo = currentInfo ? JSON.parse(currentInfo) : {};
    const updatedInfo = { ...parsedInfo, ...info };
    localStorage.setItem('guest_info', JSON.stringify(updatedInfo));
    setGuestInfo(updatedInfo as GuestInfo);
    return updatedInfo;
  };

  // Load guest info
  const loadGuestInfo = () => {
    const storedInfo = localStorage.getItem('guest_info');
    if (storedInfo) {
      try {
        const parsedInfo = JSON.parse(storedInfo);
        setGuestInfo(parsedInfo);
        return parsedInfo;
      } catch (e) {
        console.error('Error reading guest info', e);
      }
    }
    return null;
  };

  // Save messages
  const saveMessages = (msgs: Message[]) => {
    localStorage.setItem('chat_messages', JSON.stringify(msgs));
  };

  // Load messages
  const loadMessages = () => {
    const storedMessages = localStorage.getItem('chat_messages');
    if (storedMessages) {
      try {
        return JSON.parse(storedMessages) as Message[];
      } catch (e) {
        console.error('Error reading messages', e);
      }
    }
    return null;
  };

  // Clear messages
  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem('chat_messages');
    messageIdsRef.current.clear();
    
    // Welcome message
    const welcomeMessage = createWelcomeMessage();
    setMessages([welcomeMessage]);
    setLastTimestamp(welcomeMessage.timestamp);
    saveMessages([welcomeMessage]);
  };

  // Create welcome message (with name)
  const createWelcomeMessage = () => {
    const name = guestInfo?.name || 'Guest';
    return {
      id: `welcome_${Date.now()}`,
      text: `👋 Hello${name !== 'Guest' ? `, ${name}` : ''}! How can we assist you today?`,
      isUser: false,
      isAdmin: true,
      timestamp: Date.now(),
      status: 'sent' as const
    };
  };

  // Reset chat completely
  const resetChatCompletely = () => {
    // Clear local storage
    localStorage.removeItem('guest_info');
    localStorage.removeItem('chat_messages');
    
    // Reset state
    setMessages([]);
    setUserId(null);
    setGuestInfo(null);
    setLastTimestamp(0);
    messageIdsRef.current.clear();
    
    // Return to channel choice screen
    setShowChannelChoice(true);
    setShowNamePrompt(false);
    
    // Close chat
    setChatState('closed');
  };

  // ============================
  // ======== Effects ===========
  // ============================

  // 1. Load and initialize effect
  useEffect(() => {
    // Check if guest info exists
    const info = loadGuestInfo();
    
    if (info?.userId) {
      // Existing user
      setUserId(info.userId);
      
      // Load saved messages
      const savedMessages = loadMessages();
      if (savedMessages && savedMessages.length > 0) {
        setMessages(savedMessages);
        
        // Determine last message timestamp
        const lastMsg = savedMessages[savedMessages.length - 1];
        setLastTimestamp(lastMsg.timestamp || 0);
        
        // Add all message IDs to reference
        savedMessages.forEach(msg => messageIdsRef.current.add(msg.id));
      } else {
        // If no messages, show welcome
        const welcomeMsg = createWelcomeMessage();
        setMessages([welcomeMsg]);
        setLastTimestamp(welcomeMsg.timestamp);
        saveMessages([welcomeMsg]);
      }
    } else {
      // New user - prompt for choice
      setShowChannelChoice(true);
    }
  }, []);

  // 2. Scroll down when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Save messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      // Filter duplicates
      const uniqueMessages = messages.filter((msg, index, self) => 
        index === self.findIndex(m => m.id === msg.id)
      );
      
      // If duplicates existed, update state
      if (uniqueMessages.length !== messages.length) {
        setMessages(uniqueMessages);
      }
      
      // Save messages
      saveMessages(uniqueMessages);
    }
  }, [messages]);

  // 4. Poll for new messages
  const checkNewMessages = useCallback(async () => {
    if (!userId || isPollingRef.current || chatState !== 'open') return;
    
    try {
      isPollingRef.current = true;
      const cleanId = userId.replace('user_', '');
      
      // კონსოლში ვაჩვენოთ, რომ შემოწმება მოხდა
      console.log(`Checking for new messages for ${cleanId} since ${new Date(lastTimestamp).toLocaleString()}`);
      
      const response = await fetch(`/api/messenger/messages/guest/${cleanId}?lastTimestamp=${lastTimestamp}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          console.log(`Received ${data.messages.length} new messages:`, data.messages);
          
          // ფილტრაცია უკვე არსებულ მესიჯებზე
          const newMsgs = data.messages.filter((msg: any) => !messageIdsRef.current.has(msg.id));
          
          if (newMsgs.length > 0) {
            console.log(`Adding ${newMsgs.length} new messages to chat`);
            
            // შევინახოთ ID-ები
            newMsgs.forEach((msg: any) => messageIdsRef.current.add(msg.id));
            
            // დავაფორმატოთ მესიჯები
            const formattedMsgs = newMsgs.map((msg: any) => ({
              id: msg.id,
              text: msg.text,
              isUser: !msg.isAdmin,
              isAdmin: msg.isAdmin,
              timestamp: msg.timestamp,
              status: 'sent' as const
            }));
            
            // დავამატოთ ჩატში
            setMessages(prev => [...prev, ...formattedMsgs]);
            
            // განვაახლოთ ბოლო მესიჯის დრო
            if (newMsgs.length > 0) {
              const lastMsg = newMsgs.reduce((latest: any, msg: any) => 
                msg.timestamp > latest.timestamp ? msg : latest, newMsgs[0]);
              
              setLastTimestamp(lastMsg.timestamp);
              
              // განვაახლოთ სტუმრის ინფორმაცია
              saveGuestInfo({ lastMessageTimestamp: lastMsg.timestamp });
            }
          }
        }
      } else {
        const errorData = await response.json();
        console.error('Error response from API:', errorData);
      }
    } catch (error) {
      console.error('Error checking new messages:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [userId, lastTimestamp, chatState]);

  // 5. Start/stop polling
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (chatState !== 'closed' && userId) {
      // Initial check with slight delay
      const initialCheckTimeout = setTimeout(() => {
        checkNewMessages();
      }, 1000);
      
      // Regular checks
      intervalRef.current = setInterval(() => {
        checkNewMessages();
      }, 15000); // Every 15 seconds
      
      return () => {
        clearTimeout(initialCheckTimeout);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    
    return () => {};
  }, [chatState, userId, checkNewMessages]);

  // ============================
  // === Event Handlers =========
  // ============================

  // Toggle chat state
  const toggleChatState = (newState: 'closed' | 'minimized' | 'open') => {
    // If chat was open and is being closed, reset completely
    if (newState === 'closed' && chatState === 'open') {
      resetChatCompletely();
      return;
    }
    
    // Otherwise, just change state
    setChatState(newState);
    
    // If opening and user exists but no info is shown
    if (newState === 'open' && userId && !showChannelChoice && !showNamePrompt) {
      checkNewMessages();
    }
  };

  // Choose Facebook channel
  const chooseFacebookChannel = () => {
    const tempId = `${Math.random().toString(36).substring(2, 10)}`;
    
    // Save user info
    saveGuestInfo({
      userId: tempId,
      selectedChannel: 'facebook',
      lastMessageTimestamp: 0
    });
    
    setUserId(tempId);
    setShowChannelChoice(false);
    
    // Open FB Messenger
    window.open(`https://m.me/${pageId}`, '_blank');
    setChatState('closed');
  };

  // Choose guest channel
  const chooseGuestChannel = () => {
    setShowChannelChoice(false);
    setShowNamePrompt(true);
  };

  // Handle name submission
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = guestName.trim() || 'Guest';
    const tempId = `${Math.random().toString(36).substring(2, 10)}`;
    
    // Save user info with explicit guest flag
    saveGuestInfo({
      name,
      userId: tempId,
      selectedChannel: 'guest', // Make sure this is explicitly set to 'guest'
      lastMessageTimestamp: 0
    });
    
    setUserId(tempId);
    setShowNamePrompt(false);
    setChatState('open');
    
    // Welcome message
    const welcomeMsg = createWelcomeMessage();
    setMessages([welcomeMsg]);
    setLastTimestamp(welcomeMsg.timestamp);
    saveMessages([welcomeMsg]);
    
    // Log to ensure we're setting guest correctly
    console.log("Guest user created with name:", name);
  };

  // Handle message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSubmittingRef.current || !userId) return;
    
    // Mark as submitting
    isSubmittingRef.current = true;
    
    // Message ID
    const messageId = `msg_${Date.now()}`;
    messageIdsRef.current.add(messageId);
    
    // Add message locally first
    const userMessage: Message = {
      id: messageId,
      text: newMessage,
      isUser: true,
      timestamp: Date.now(),
      status: 'sending'
    };
    
    // Clear input
    const messageCopy = newMessage;
    setNewMessage('');
    
    // Add message to chat
    setMessages(prev => [...prev, userMessage]);
    
    try {
      // Send to API with explicit guest info
      const response = await fetch('/api/messenger/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: pageId,
          message: messageCopy,
          userId: userId,
          guestName: guestInfo?.name || 'Guest',
          isGuest: true, // Explicitly mark as guest
          clientMessageId: messageId
        }),
      });
      
      const result = await response.json();
      
      // Update message status
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? {...msg, status: 'sent' as const} : msg
      ));
      
      // Update last message timestamp
      setLastTimestamp(userMessage.timestamp);
      
      // Update guest info
      saveGuestInfo({ lastMessageTimestamp: userMessage.timestamp });
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update message status - error
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? {...msg, status: 'error' as const} : msg
      ));
      
      // Add error message
      const errorId = `error_${Date.now()}`;
      messageIdsRef.current.add(errorId);
      
      setMessages(prev => [...prev, {
        id: errorId,
        text: "Message could not be sent. Please try again later.",
        isUser: false,
        isAdmin: true,
        timestamp: Date.now()
      }]);
    } finally {
      // Clear submitting status
      isSubmittingRef.current = false;
    }
  };

  // ============================
  // ======== Rendering =========
  // ============================

  // Render channel choice screen
  const renderChannelChoice = () => (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <div className={styles.chatTitle}>Choose Chat</div>
        <button className={styles.closeBtn} onClick={() => setChatState('closed')}>&times;</button>
      </div>
      
      <div className={styles.channelChoiceContainer}>
        <h3>How would you like to connect with us?</h3>
        
        <div className={styles.channelOptions}>
          <button className={styles.channelButton} onClick={chooseGuestChannel}>
            <span className={styles.channelIcon}>👤</span>
            <span>Continue as Guest</span>
            <p className={styles.channelDesc}>Use chat anonymously without an account</p>
          </button>
          
          <button className={styles.channelButton} onClick={chooseFacebookChannel}>
            <span className={styles.channelIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#0084ff">
                <path d="M12 2C6.36 2 2 6.13 2 11.7C2 14.61 3.33 17.13 5.47 18.77V22L9.72 19.94C10.46 20.09 11.22 20.17 12 20.17C17.64 20.17 22 16.04 22 10.47C22 4.9 17.64 2 12 2Z" />
              </svg>
            </span>
            <span>Facebook Messenger</span>
            <p className={styles.channelDesc}>Use your Facebook account</p>
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render name prompt form
  const renderNamePrompt = () => (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <div className={styles.chatTitle}>Welcome!</div>
        <button className={styles.closeBtn} onClick={() => setChatState('closed')}>&times;</button>
      </div>
      
      <form onSubmit={handleNameSubmit} className={styles.namePromptForm}>
        <h3>What should we call you?</h3>
        <p>Enter your name to make communication more personal</p>
        
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Your name"
          className={styles.nameInput}
          autoFocus
        />
        
        <div className={styles.namePromptActions}>
          <button type="button" onClick={() => {
            setGuestName('Guest');
            handleNameSubmit(new Event('submit') as any);
          }} className={styles.skipButton}>
            Skip
          </button>
          
          <button type="submit" className={styles.continueButton}>
            Continue
          </button>
        </div>
      </form>
    </div>
  );
  
  // Render chat
  const renderChat = () => (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <div className={styles.chatTitle}>Chat with us</div>
        <div className={styles.headerControls}>
          <button 
            className={styles.minimizeBtn} 
            onClick={() => toggleChatState('minimized')}
            title="Minimize"
          >
            _
          </button>
          <button 
            className={styles.closeBtn} 
            onClick={() => toggleChatState('closed')}
            title="Close"
          >
            &times;
          </button>
        </div>
      </div>
      
      <div className={styles.messagesContainer}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`${styles.message} ${msg.isUser ? styles.userMessage : styles.botMessage}`}
          >
            {msg.text}
            {msg.status === 'sending' && <span className={styles.messageStatus}>Sending...</span>}
            {msg.status === 'error' && <span className={styles.messageError}>Failed to send</span>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className={styles.chatControls}>
        <button
          onClick={clearMessages}
          className={styles.clearButton}
          title="Clear messages"
        >
          Clear
        </button>
        
        {guestInfo?.selectedChannel === 'guest' && (
          <button
            onClick={chooseFacebookChannel}
            className={styles.switchChannelButton}
            title="Switch to Facebook Messenger"
          >
            Switch to Facebook
          </button>
        )}
      </div>
      
      <form className={styles.inputContainer} onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className={styles.messageInput}
          disabled={isSubmittingRef.current}
        />
        <button 
          type="submit" 
          className={styles.sendButton}
          disabled={isSubmittingRef.current || !newMessage.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
          </svg>
        </button>
      </form>
    </div>
  );

  // Render minimized chat
  const renderMinimizedChat = () => (
    <div className={styles.minimizedContainer}>
      <div className={styles.minimizedContent} onClick={() => toggleChatState('open')}>
        <span className={styles.minimizedText}>
          Continue chat
        </span>
      </div>
      <button 
        className={styles.closeMinimizedBtn} 
        onClick={() => toggleChatState('closed')}
        title="Close"
      >
        &times;
      </button>
    </div>
  );

  return (
    <>
      {/* Facebook SDK */}
      <div id="fb-root"></div>
      <Script
        id="facebook-jssdk"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.fbAsyncInit = function() {
              FB.init({
                xfbml: true,
                version: 'v22.0',
                appId: '${appId}'
              });
            };
            (function(d, s, id) {
              var js, fjs = d.getElementsByTagName(s)[0];
              if (d.getElementById(id)) return;
              js = d.createElement(s); js.id = id;
              js.src = 'https://connect.facebook.net/en_US/sdk.js';
              fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
          `
        }}
      />
      
      {/* Custom Chat Widget */}
      <div className={styles.chatWidget}>
        {chatState === 'open' && (
          showChannelChoice ? renderChannelChoice() :
          showNamePrompt ? renderNamePrompt() :
          renderChat()
        )}
        
        {chatState === 'minimized' && renderMinimizedChat()}
        
        {chatState === 'closed' && (
          <button 
            className={styles.chatButton} 
            onClick={() => {
              setChatState('open');
              if (!userId) {
                setShowChannelChoice(true);
              }
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.36 2 2 6.13 2 11.7C2 14.61 3.33 17.13 5.47 18.77V22L9.72 19.94C10.46 20.09 11.22 20.17 12 20.17C17.64 20.17 22 16.04 22 10.47C22 4.9 17.64 2 12 2ZM13.12 15.1L10.09 11.86L4.31 15.1L10.55 8.31L13.6 11.54L19.34 8.31L13.12 15.1Z" fill="white" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
};

export default MessengerChat;
