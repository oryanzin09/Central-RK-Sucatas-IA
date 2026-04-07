import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const addNotification = async (title: string, message: string) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      title,
      message,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erro ao adicionar notificação:', error);
  }
};
