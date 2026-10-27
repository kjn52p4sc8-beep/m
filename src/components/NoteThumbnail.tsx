import { useEffect, useState } from "react";
import { firstAttachment } from "../data/repository";
import type { Attachment } from "../data/model";
import AnnotationView from "./AnnotationView";

export default function NoteThumbnail({ noteId, updatedAt }: { noteId: string; updatedAt: string }) {
  const [image, setImage] = useState<{ item: Attachment; url: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let url = "";
    void firstAttachment(noteId).then((item) => {
      if (!alive) return;
      if (item) {
        url = URL.createObjectURL(item.blob);
        setImage({ item, url });
      } else setImage(null);
    }).catch(() => setImage(null));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [noteId, updatedAt]);
  if (!image) return null;
  return <svg className="note-thumbnail" aria-hidden="true" viewBox={`0 0 ${image.item.width} ${image.item.height}`}>
    <image href={image.url} width={image.item.width} height={image.item.height} />
    <AnnotationView items={image.item.annotations} />
  </svg>;
}
