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

const MessengerChat: React.FC<MessengerChatProps> = ({ 
  pageId = messengerConfig.pageId,
  appId = messengerConfig.appId 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [lastTimestamp, setLastTimestamp] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const messageIdsRef = useRef<Set<string>>(new Set());

  // Clear any duplicate messages on first load
  useEffect(() => {
    const uniqueMessages = messages.filter((msg, index, self) => {
      const firstIndex = self.findIndex(m => m.id === msg.id);
      return index === firstIndex;
    });
    
    if (uniqueMessages.length !== messages.length) {
      setMessages(uniqueMessages);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate a temporary user ID and set up initial message
  useEffect(() => {
    if (!userId) {
      const storedUserId = localStorage.getItem('fb_chat_user_id');
      if (storedUserId) {
        setUserId(storedUserId);
      } else {
        const tempId = `${Math.random().toString(36).substring(2, 10)}`;
        setUserId(tempId);
        localStorage.setItem('fb_chat_user_id', tempId);
      }
      
      setTimeout(() => {
        const welcomeMsg = {
          id: `welcome_${Date.now()}`,
          text: "👋 გამარჯობა! როგორ შეგვიძლია დაგეხმაროთ დღეს?",
          isUser: false,
          isAdmin: true,
          timestamp: Date.now()
        };
        
        setMessages([welcomeMsg]);
        setLastTimestamp(welcomeMsg.timestamp);
      }, 1000);
    }
    
    const savedMessages = localStorage.getItem('fb_chat_messages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
        
        if (parsedMessages.length > 0) {
          const lastMsg = parsedMessages[parsedMessages.length - 1];
          setLastTimestamp(lastMsg.timestamp);
        }
      } catch (e) {
        console.error('შეტყობინებების ჩატვირთვის შეცდომა:', e);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId]);

  const checkNewMessages = useCallback(async () => {
    if (!userId || isPollingRef.current || !isOpen) return;
    
    try {
      isPollingRef.current = true;
      const cleanId = userId.replace('user_', '');
      
      const response = await fetch(`/api/messenger/messages/guest/${cleanId}?lastTimestamp=${lastTimestamp}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          const newMsgs = data.messages.filter((msg: any) => !messageIdsRef.current.has(msg.id));
          
          if (newMsgs.length > 0) {
            console.log(`Received ${newMsgs.length} new messages`);
            
            newMsgs.forEach((msg: any) => messageIdsRef.current.add(msg.id));
            
            const formattedMsgs = newMsgs.map((msg: any) => ({
              id: msg.id,
              text: msg.text,
              isUser: !msg.isAdmin,
              isAdmin: msg.isAdmin,
              timestamp: msg.timestamp,
              status: 'sent' as const
            }));
            
            setMessages(prev => [...prev, ...formattedMsgs]);
            
            if (newMsgs.length > 0) {
              const lastMsg = newMsgs.reduce((latest: any, msg: any) => 
                msg.timestamp > latest.timestamp ? msg : latest, newMsgs[0]);
              
              setLastTimestamp(lastMsg.timestamp);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking messages:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [userId, lastTimestamp, isOpen]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isOpen && userId) {
      const initialCheck = setTimeout(() => {
        checkNewMessages();
      }, 1000);
      
      intervalRef.current = setInterval(() => {
        checkNewMessages();
      }, messengerConfig.pollingInterval);
      
      return () => {
        clearTimeout(initialCheck);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    
    return undefined;
  }, [isOpen, userId, checkNewMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      const uniqueMessages = messages.filter((msg, index, self) => {
        const firstIndex = self.findIndex(m => m.id === msg.id);
        return index === firstIndex;
      });
      
      localStorage.setItem('fb_chat_messages', JSON.stringify(uniqueMessages));
      
      uniqueMessages.forEach(msg => messageIdsRef.current.add(msg.id));
    }
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    
    const messageId = `msg_${Date.now()}`;
    messageIdsRef.current.add(messageId);
    
    const userMessage: Message = {
      id: messageId,
      text: newMessage,
      isUser: true,
      timestamp: Date.now(),
      status: 'sending'
    };
    
    const messageCopy = newMessage;
    setNewMessage('');
    
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch('/api/messenger/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: pageId,
          message: messageCopy,
          userId: userId || 'user_temp',
          clientMessageId: messageId
        }),
      });
      
      const result = await response.json();
      
      if (result.isDuplicate) {
        console.log("Message was detected as a duplicate");
      } else {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? {...msg, status: 'sent' as const} : msg
        ));
        
        setLastTimestamp(userMessage.timestamp);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? {...msg, status: 'error' as const} : msg
      ));
      
      const errorId = `error_${Date.now()}`;
      messageIdsRef.current.add(errorId);
      
      setMessages(prev => [...prev, {
        id: errorId,
        text: "Sorry, we couldn't send your message. Please try again later.",
        isUser: false,
        isAdmin: true,
        timestamp: Date.now()
      }]);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <>
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
      
      <div className={styles.chatWidget}>
        {isOpen ? (
          <div className={styles.chatContainer}>
            <div className={styles.chatHeader}>
              <div className={styles.chatTitle}>Chat with us</div>
              <button className={styles.closeBtn} onClick={toggleChat}>&times;</button>
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
                disabled={isSubmittingRef.current}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
                </svg>
              </button>
            </form>
          </div>
        ) : (
          <button className={styles.chatButton} onClick={toggleChat}>
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
