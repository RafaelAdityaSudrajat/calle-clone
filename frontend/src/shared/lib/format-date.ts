const formatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatDate = (iso: string): string =>
  formatter.format(new Date(iso));
