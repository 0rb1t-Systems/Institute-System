import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
      >
        <h1 className="text-9xl font-black text-primary animate-pulse">404</h1>
        <h2 className="mt-4 text-4xl font-bold text-white">Page Not Found</h2>
        <p className="mt-2 text-lg text-slate-400">
          Oops! The page you are looking for does not exist.
        </p>
        <Button asChild className="mt-8">
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;