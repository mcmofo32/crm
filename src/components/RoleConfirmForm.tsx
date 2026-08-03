"use client";

export function RoleConfirmForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const role = new FormData(e.currentTarget).get("role");
        if (
          role === "ADMIN" &&
          !confirm(
            "Weet je zeker dat je deze gebruiker Admin-rechten wilt geven? Dit geeft toegang tot bijna alle beheerfuncties."
          )
        ) {
          e.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </form>
  );
}
