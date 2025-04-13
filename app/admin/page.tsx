"use client";

import { useEffect, useState, useRef } from 'react';
import styles from './admin.module.css';

interface User {
  psid: string;
  lastActive: string;
  lastMessage?: string;
  name?: string;
  isGuest?: boolean;
}

interface Message {
  id: string;
  psid: string;
  text: string;
  isAdmin: boolean;
  timestamp: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<Record<string, User>>({});
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // ყველა მომხმარებლის ჩამოტვირთვა
  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch('/api/messenger/users');
        
        if (!response.ok) {
          throw new Error('მომხმარებლების მონაცემების მიღება ვერ მოხერხდა');
        }
        
        const data = await response.json();
        setUsers(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'უცნობი შეცდომა');
      } finally {
        setLoading(false);
      }
    }
    
    fetchUsers();
    
    // პერიოდული განახლება
    const intervalId = setInterval(fetchUsers, 30000); // ყოველ 30 წამში
    
    return () => clearInterval(intervalId);
  }, []);
  
  // კონკრეტული მომხმარებლის შეტყობინებების ჩამოტვირთვა
  useEffect(() => {
    if (selectedUser) {
      fetchUserMessages(selectedUser);
      
      // პერიოდულად შეტყობინებების განახლება
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      
      pollingInterval.current = setInterval(() => {
        fetchUserMessages(selectedUser);
      }, 5000); // ყოველ 5 წამში
    }
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [selectedUser]);
  
  // შეტყობინებებში ჩასქროლვა
  useEffect(() => {
    if (messagesEndRef.current && selectedUser) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedUser, selectedUser ? conversations[selectedUser] : null]);
  
  // მომხმარებლის შეტყობინებების ჩამოტვირთვის ფუნქცია
  const fetchUserMessages = async (userId: string) => {
    try {
      const response = await fetch(`/api/messenger/messages/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setConversations(prev => ({
            ...prev,
            [userId]: data.messages
          }));
        }
      }
    } catch (error) {
      console.error('შეტყობინებების მიღების შეცდომა:', error);
    }
  };
  
  // მომხმარებლის არჩევა
  const handleUserSelect = (userId: string) => {
    if (selectedUser === userId) {
      // თუ უკვე არჩეულია, გაუქმება
      setSelectedUser(null);
    } else {
      // ახალი მომხმარებლის არჩევა
      setSelectedUser(userId);
    }
  };
  
  // შეტყობინების გაგზავნა
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !newMessage.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/messenger/admin/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientId: selectedUser,
          message: newMessage,
          isAdmin: true
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          setNewMessage('');
          // შეტყობინებების განახლება
          fetchUserMessages(selectedUser);
        }
      }
    } catch (error) {
      console.error('შეტყობინების გაგზავნის შეცდომა:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // მომხმარებლის ტიპის მიხედვით კლასის დამატება
  const getUserClassName = (user: User) => {
    let className = '';
    if (user.isGuest) className += styles.guestUser;
    if (selectedUser === user.psid) className += ' ' + styles.selectedUser;
    return className;
  };

  return (
    <div className={styles.container}>
      <h1>ადმინისტრატორის პანელი</h1>
      
      <div className={styles.dashboard}>
        <div className={styles.usersPanel}>
          <h2>მომხმარებლები</h2>
          
          {loading && <p>მიმდინარეობს ჩატვირთვა...</p>}
          {error && <p className={styles.error}>{error}</p>}
          
          {!loading && !error && Object.keys(users).length === 0 && (
            <p>მომხმარებლები არ არის ნაპოვნი. ჯერ არავის გამოუყენებია ჩატი.</p>
          )}
          
          {Object.keys(users).length > 0 && (
            <table className={styles.userTable}>
              <thead>
                <tr>
                  <th>სახელი/ID</th>
                  <th>ტიპი</th>
                  <th>ბოლო აქტივობა</th>
                  <th>მოქმედება</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(users).map((user) => (
                  <tr key={user.psid} className={getUserClassName(user)}>
                    <td className={styles.userId}>{user.psid}</td>
                    <td>{user.isGuest ? 'სტუმარი' : 'Facebook'}</td>
                    <td>{new Date(user.lastActive).toLocaleString()}</td>
                    <td>
                      <button 
                        className={styles.chatButton}
                        onClick={() => handleUserSelect(user.psid)}
                      >
                        {selectedUser === user.psid ? 'დახურვა' : 'ჩატი'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {selectedUser && (
          <div className={styles.chatPanel}>
            <div className={styles.chatHeader}>
              <div>
                <span className={styles.chatTitle}>
                  {users[selectedUser]?.isGuest ? 'სტუმარი' : 'Facebook მომხმარებელი'}
                </span>
                <span className={styles.chatSubtitle}>{selectedUser}</span>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className={styles.closeButton}
              >
                &times;
              </button>
            </div>
            
            <div className={styles.chatMessages}>
              {!conversations[selectedUser] || conversations[selectedUser].length === 0 ? (
                <div className={styles.noMessages}>
                  შეტყობინებები არ არის
                </div>
              ) : (
                conversations[selectedUser].map((msg) => (
                  <div 
                    key={msg.id}
                    className={`${styles.message} ${msg.isAdmin ? styles.adminMessage : styles.userMessage}`}
                  >
                    <div className={styles.messageContent}>
                      {msg.text}
                    </div>
                    <div className={styles.messageTime}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSendMessage} className={styles.messageForm}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="შეიყვანეთ შეტყობინება..."
                disabled={isSubmitting}
                className={styles.messageInput}
              />
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={styles.sendButton}
              >
                {isSubmitting ? 'იგზავნება...' : 'გაგზავნა'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
