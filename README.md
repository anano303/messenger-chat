# Messenger Chat

A flexible, self-contained chat solution that integrates with Facebook Messenger and supports anonymous guest chatting. This application provides a complete chat experience for your website alongside an admin panel for managing conversations.

## Features

- **Dual chat options**: Users can choose between Facebook Messenger or anonymous guest chat
- **Admin Panel**: For managing all conversations from a single interface
- **Persistent chat history**: Messages stored in MongoDB database
- **Real-time updates**: Automatic polling for new messages
- **Custom styling**: Easily customize the look and feel to match your brand
- **Responsive design**: Works on desktop and mobile devices

## Setup Instructions

### Prerequisites

1. Node.js 18.x or higher
2. Facebook Developer Account (for Messenger integration)
3. MongoDB database (Atlas or self-hosted)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/messenger-chat.git
   cd messenger-chat
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Create a `.env.local` file in the project root
   - Add the following variables:
     ```
     # Facebook Messenger Configuration
     NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
     NEXT_PUBLIC_FACEBOOK_PAGE_ID=your_facebook_page_id
     MESSENGER_PAGE_ACCESS_TOKEN=your_page_access_token
     MESSENGER_VERIFY_TOKEN=your_webhook_verify_token
     
     # MongoDB Configuration
     MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/databaseName
     MONGO_USERNAME=your_mongodb_username
     MONGO_PASSWORD=your_mongodb_password
     ```

4. Start the development server:
   ```
   npm run dev
   ```

### MongoDB Setup

1. Create a MongoDB Atlas account or use a self-hosted MongoDB instance
2. Create a database named `soulartChat` (or your preferred name)
3. The application will automatically create these collections:
   - `users`: Stores user information
   - `messages`: Stores chat messages

### Facebook Setup

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com/)
2. Set up Messenger integration
3. Configure webhooks for message events
4. Generate a Page Access Token for your Facebook Page
5. Update the `.env.local` file with the generated credentials

## Usage

### Add to your website

1. Deploy the application to your hosting provider
2. Add the chat widget to your website by including:

```html
<script src="https://your-deployed-url.com/messenger-chat.js" defer></script>
```

### Chat Component

The chat component will appear as a floating button in the bottom right corner of your website. When clicked, it opens a chat interface where users can:

- Choose between guest chat or Facebook Messenger
- Enter their name (for guest chat)
- Send and receive messages
- Clear their chat history
- Minimize or close the chat window

### Admin Panel

Access the admin panel at `/admin` to:

1. **View all conversations**: See a list of all users who have contacted you
2. **Respond to messages**: Send replies to both Facebook and guest users
3. **Chat history**: Access the complete chat history for each user
4. **User information**: See user details including their name and conversation timestamps

## How It Works

### Data Storage

1. **MongoDB**: All messages and user information are stored in MongoDB
2. **Collections**:
   - `users`: Stores user profiles, names, and metadata
   - `messages`: Stores all chat messages with references to users

### Guest Chat Flow

1. User clicks the chat button
2. User chooses "Continue as Guest"
3. User enters their name (or skips this step)
4. User can now send messages and will receive admin responses
5. Chat messages are stored in MongoDB
6. When the user closes the chat (X button), the session ends but history remains in the database
7. When the user minimizes the chat, session remains active

### Facebook Messenger Flow

1. User clicks the chat button
2. User chooses "Facebook Messenger"
3. User is redirected to Messenger to continue the conversation
4. Messages are sent and received through Facebook's API

### Admin Panel

1. Admin logs in to the admin interface
2. Admin sees a list of all users (both guest and Facebook users)
3. Admin selects a user to view their conversation
4. Admin can respond directly from the panel
5. For Facebook users, messages are sent via the Messenger API
6. For guest users, messages are stored in the database and delivered when the guest checks for updates

## File Structure

- `/app/components/MessengerChat.tsx` - Main chat component
- `/app/admin/page.tsx` - Admin panel interface
- `/app/api/messenger/` - API routes for sending and receiving messages
- `/app/lib/messenger-db.ts` - Database utilities for MongoDB
- `/app/lib/mongodb.ts` - MongoDB connection utility

## Customization

### Styling

Modify the CSS modules to customize the appearance:
- `/app/components/MessengerChat.module.css` - Chat widget styling
- `/app/admin/admin.module.css` - Admin panel styling

### Configuration

Update environment variables in `.env.local` to change:
- Facebook application details
- Polling intervals
- MongoDB connection settings

## Troubleshooting

- **Messages not appearing**: Check browser console for errors and MongoDB connection
- **Facebook integration not working**: Verify app permissions and page access token
- **Admin panel issues**: Check server logs for database connection problems
- **MongoDB connection errors**: Verify your MongoDB connection string and network access settings

## License

[MIT License](LICENSE)

