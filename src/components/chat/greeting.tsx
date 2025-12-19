// components/greeting.tsx

import { motion } from "motion/react"

export const Greeting = () => {
  return (
    <div
      key="overview"
      className="mx-auto flex size-full max-w-3xl flex-col justify-center px-4 text-center sm:px-6 md:mt-20 md:text-left"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
        className="text-lg font-semibold sm:text-2xl"
      >
        Hola! Mi nombre es Dora
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-md text-zinc-500 sm:text-2xl"
      >
        Cómo puedo ayudarte hoy?
      </motion.div>
    </div>
  );
};
