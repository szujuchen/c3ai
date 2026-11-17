// How many days before the due date an assignment's effort is spread over.
export const LEAD_DAYS = { homework: 3, quiz: 3, lab: 3, project: 5, midterm: 4, final: 4 };

export const leadDaysFor = (type) => LEAD_DAYS[type] || 3;
