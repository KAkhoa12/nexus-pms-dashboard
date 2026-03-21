type PlaceholderPageProps = {
  title: string;
  description?: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {description ?? "Màn hình này đang được cập nhật theo nghiệp vụ của hệ thống."}
      </p>
    </section>
  );
}
