import React from "react";
import { Info, AlertCircle, CheckCircle } from "lucide-react";

interface AlertProps {
  type?: "info" | "warning" | "success";
  message: string;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ type = "info", message, className = "" }) => {
  const styles = {
    info: "bg-primary/5 text-primary border-primary/10",
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-secondary/10 text-secondary border-secondary/20",
  };

  const icons = {
    info: <Info size={20} className="shrink-0" />,
    warning: <AlertCircle size={20} className="shrink-0" />,
    success: <CheckCircle size={20} className="shrink-0" />,
  };

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${styles[type]} ${className}`}>
      {icons[type]}
      <span className="text-sm font-medium leading-snug">
        {message}
      </span>
    </div>
  );
};
