"use client"
import { useState, useTransition } from "react"
import "../assets/style/sharedUserWindow.css"
import { shareProject } from "@/app/dashboard/actions"

export default function SharedUserWindow({ projectId, title, users, onClose }) {
    const [email, setEmail] = useState('')
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState('')


    const handleShare = async () => {
        if (!email) return;
        setError('');

        startTransition(async () => {
            try {
                await shareProject(projectId, email);
                setEmail('');
            } catch (err) {
                setError(err.message);
            }
        });
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="window-container" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2>Project <strong>{title}</strong> - Sharing</h2>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>
                
                <p className="description">Please write here the email of the user you want to share</p>
                
                <div className="input-group">
                    <input 
                        type="email" 
                        placeholder="example@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isPending}
                    />
                    <button 
                        className="btn-add" 
                        onClick={handleShare}
                        disabled={isPending || !email}
                    >
                        {isPending ? "Sharing..." : "Share"}
                    </button>
                </div>

                {error && <p className="error-text" style={{color: 'red', fontSize: '0.8rem'}}>{error}</p>}

                <div className="user-shared-container">
                    <h3>Shared with:</h3>
                    {users.length === 0 ? (
                        <p className="empty-msg">No person shared yet.</p>
                    ) : (
                        <>
                            <ul className="user-list">
                                {users.map((u, index) => (
                                    <li key={index} className="user-item">
                                        <span className="user-icon">👤</span>
                                        {u.email}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}