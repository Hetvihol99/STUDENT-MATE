import type {Material, Topic} from "./demo.ts";

export function selectPractice(topics: Topic[], materials: Material[], course: string, target = "") {
  const ready = materials.filter(m => m.course === course && m.status === "Ready to study");
  const requested = topics.find(t => t.id === target && ready.some(m => m.id === t.materialId));
  const material = ready.find(m => m.id === requested?.materialId) || ready[0];
  return {
    materialId: material?.id || "",
    topic: requested?.id || "all",
    source: material?.seeded ? "prepared" : "ai",
  };
}
