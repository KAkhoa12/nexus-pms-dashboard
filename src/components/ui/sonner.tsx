import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast border shadow-lg",
          title: "font-medium",
          description: "text-muted-foreground",
          success:
            "!border-emerald-200 !bg-emerald-50 !text-emerald-900 dark:!border-emerald-800 dark:!bg-emerald-950 dark:!text-emerald-100",
          error:
            "!border-red-200 !bg-red-50 !text-red-900 dark:!border-red-800 dark:!bg-red-950 dark:!text-red-100",
          warning:
            "!border-amber-200 !bg-amber-50 !text-amber-900 dark:!border-amber-800 dark:!bg-amber-950 dark:!text-amber-100",
          info: "!border-sky-200 !bg-sky-50 !text-sky-900 dark:!border-sky-800 dark:!bg-sky-950 dark:!text-sky-100",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
