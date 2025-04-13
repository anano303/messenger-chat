import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Welcome to our website</h1>
        <p>We're currently building something amazing!</p>
        <p>
          Need help? Click the <strong>Messenger icon</strong> in the bottom right corner 
          to chat with us directly!
        </p>
      </main>
    </div>
  );
}
