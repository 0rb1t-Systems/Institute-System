const sortByDiplomaOrder = (list = []) =>
  [...list].sort((a, b) => {
    const ao = Number(a?.sort_order ?? 0);
    const bo = Number(b?.sort_order ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });

/** Courses assigned to a diploma (join table, with legacy diploma_id fallback). */
export function coursesForDiploma(courses = [], diplomaCourses = [], diplomaId) {
  if (!diplomaId) return [];
  const links = (diplomaCourses || []).filter((dc) => dc.diploma_id === diplomaId);
  if (links.length > 0) {
    const byId = new Map((courses || []).map((c) => [c.id, c]));
    return sortByDiplomaOrder(
      links
        .map((dc) => {
          const course = byId.get(dc.course_id);
          return course ? { ...course, sort_order: dc.sort_order } : null;
        })
        .filter(Boolean)
    );
  }
  return sortByDiplomaOrder((courses || []).filter((c) => c.diploma_id === diplomaId));
}

export function diplomasForCourse(diplomas = [], diplomaCourses = [], course) {
  if (!course) return [];
  const ids = (diplomaCourses || [])
    .filter((dc) => dc.course_id === course.id)
    .map((dc) => dc.diploma_id);
  if (ids.length > 0) {
    const wanted = new Set(ids);
    return (diplomas || []).filter((d) => wanted.has(d.id));
  }
  if (course.diploma_id) {
    const one = (diplomas || []).find((d) => d.id === course.diploma_id);
    return one ? [one] : [];
  }
  return [];
}

export function diplomaIdsForCourse(diplomaCourses = [], course) {
  if (!course) return [];
  const ids = (diplomaCourses || [])
    .filter((dc) => dc.course_id === course.id)
    .map((dc) => dc.diploma_id);
  if (ids.length) return ids;
  return course.diploma_id ? [course.diploma_id] : [];
}

/** Courses a class can assign work to: linked class courses + diploma program courses. */
export function coursesForClass(classRow, courses = [], classCourses = [], diplomaCourses = []) {
  if (!classRow) return [];
  const list = [];
  const add = (course) => {
    if (course && !list.some((c) => c.id === course.id)) list.push(course);
  };
  if (classRow.course_id) {
    add((courses || []).find((c) => c.id === classRow.course_id));
  }
  ;(classCourses || [])
    .filter((cc) => cc.class_id === classRow.id)
    .forEach((cc) => add((courses || []).find((c) => c.id === cc.course_id)));
  if (classRow.diploma_id) {
    coursesForDiploma(courses, diplomaCourses, classRow.diploma_id).forEach(add);
  }
  return list;
}
