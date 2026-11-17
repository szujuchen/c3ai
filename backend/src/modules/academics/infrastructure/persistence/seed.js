// Mock data shaped like the Canvas REST API and Google Calendar API responses.
// Swap these for real Canvas / Google Calendar calls later (see README).
export const MOCK = {
  "canvasCourses": [
    {
      "id": 101,
      "course_code": "15-122",
      "name": "Principles of Imperative Computation",
      "meeting_times": "MWF 10:00-10:50"
    },
    {
      "id": 102,
      "course_code": "21-241",
      "name": "Matrices and Linear Transformations",
      "meeting_times": "MWF 13:00-13:50"
    },
    {
      "id": 103,
      "course_code": "33-141",
      "name": "Physics I for Engineering Students",
      "meeting_times": "TR 9:30-10:50"
    },
    {
      "id": 104,
      "course_code": "76-101",
      "name": "Interpretation and Argument",
      "meeting_times": "TR 14:00-15:20"
    }
  ],
  "canvasAssignments": [
    {
      "id": 5001,
      "course_id": 101,
      "name": "HW 9: Hash tables",
      "due_at": "2026-12-02T23:59:00-05:00",
      "points_possible": 50,
      "type": "homework",
      "effort_h": 4
    },
    {
      "id": 5002,
      "course_id": 101,
      "name": "Quiz 6",
      "due_at": "2026-12-04T10:00:00-05:00",
      "points_possible": 20,
      "type": "quiz",
      "effort_h": 2
    },
    {
      "id": 5003,
      "course_id": 101,
      "name": "Programming Project: Text editor",
      "due_at": "2026-12-10T23:59:00-05:00",
      "points_possible": 150,
      "type": "project",
      "effort_h": 15
    },
    {
      "id": 5004,
      "course_id": 101,
      "name": "Final Exam",
      "due_at": "2026-12-16T13:00:00-05:00",
      "points_possible": 200,
      "type": "final",
      "effort_h": 12
    },
    {
      "id": 5101,
      "course_id": 102,
      "name": "HW 11: Eigenvalues",
      "due_at": "2026-12-03T23:59:00-05:00",
      "points_possible": 40,
      "type": "homework",
      "effort_h": 3
    },
    {
      "id": 5102,
      "course_id": 102,
      "name": "HW 12: Diagonalization",
      "due_at": "2026-12-09T23:59:00-05:00",
      "points_possible": 40,
      "type": "homework",
      "effort_h": 3
    },
    {
      "id": 5103,
      "course_id": 102,
      "name": "Final Exam",
      "due_at": "2026-12-14T08:30:00-05:00",
      "points_possible": 200,
      "type": "final",
      "effort_h": 12
    },
    {
      "id": 5201,
      "course_id": 103,
      "name": "Lab Report 8",
      "due_at": "2026-12-04T23:59:00-05:00",
      "points_possible": 30,
      "type": "lab",
      "effort_h": 4
    },
    {
      "id": 5202,
      "course_id": 103,
      "name": "Lab Report 9",
      "due_at": "2026-12-15T23:59:00-05:00",
      "points_possible": 30,
      "type": "lab",
      "effort_h": 4
    },
    {
      "id": 5301,
      "course_id": 104,
      "name": "Essay 3 draft",
      "due_at": "2026-12-03T23:59:00-05:00",
      "points_possible": 50,
      "type": "homework",
      "effort_h": 4
    },
    {
      "id": 5302,
      "course_id": 104,
      "name": "Essay 3 final",
      "due_at": "2026-12-10T23:59:00-05:00",
      "points_possible": 100,
      "type": "project",
      "effort_h": 8
    },
    {
      "id": 5303,
      "course_id": 104,
      "name": "Reflection portfolio",
      "due_at": "2026-12-17T23:59:00-05:00",
      "points_possible": 100,
      "type": "project",
      "effort_h": 6
    },
    {
      "id": 5304,
      "course_id": 104,
      "name": "Reading quiz 10",
      "due_at": "2026-12-18T14:00:00-05:00",
      "points_possible": 10,
      "type": "quiz",
      "effort_h": 1
    }
  ],
  "gcalEvents": {
    "kind": "calendar#events",
    "items": [
      {
        "id": "ev1",
        "summary": "Robotics club meeting",
        "start": {
          "dateTime": "2026-12-01T18:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-01T20:00:00-05:00"
        },
        "host_type": "general"
      },
      {
        "id": "ev2",
        "summary": "Part-time job: library desk",
        "start": {
          "dateTime": "2026-12-05T10:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-05T14:00:00-05:00"
        },
        "host_type": "personal"
      },
      {
        "id": "ev3",
        "summary": "Google info session",
        "start": {
          "dateTime": "2026-12-08T18:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-08T19:00:00-05:00"
        },
        "host_type": "recruiting"
      },
      {
        "id": "ev4",
        "summary": "Part-time job: library desk",
        "start": {
          "dateTime": "2026-12-12T10:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-12T14:00:00-05:00"
        },
        "host_type": "personal"
      },
      {
        "id": "ev5",
        "summary": "Therapy dogs in the student center",
        "start": {
          "dateTime": "2026-12-09T18:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-09T19:30:00-05:00"
        },
        "host_type": "relax"
      },
      {
        "id": "ev6",
        "summary": "Startup recruiting mixer",
        "start": {
          "dateTime": "2026-12-15T18:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-15T19:30:00-05:00"
        },
        "host_type": "recruiting"
      },
      {
        "id": "ev7",
        "summary": "Robotics club meeting",
        "start": {
          "dateTime": "2026-12-08T18:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-08T20:00:00-05:00"
        },
        "host_type": "general"
      },
      {
        "id": "ev8",
        "summary": "Holiday game night",
        "start": {
          "dateTime": "2026-12-19T19:00:00-05:00"
        },
        "end": {
          "dateTime": "2026-12-19T22:00:00-05:00"
        },
        "host_type": "relax"
      }
    ]
  },
  "students": [
    {
      "id": "s1",
      "name": "Maya",
      "major": "CS",
      "year": 3,
      "daily_cap_h": 6,
      "course_ids": [
        101,
        102,
        103,
        104
      ],
      "event_ids": [
        "ev1",
        "ev3",
        "ev5",
        "ev6",
        "ev7"
      ]
    },
    {
      "id": "s2",
      "name": "Leo",
      "major": "CS",
      "year": 3,
      "daily_cap_h": 6,
      "course_ids": [
        101,
        102,
        104
      ],
      "event_ids": [
        "ev3",
        "ev6"
      ]
    },
    {
      "id": "s3",
      "name": "Aisha",
      "major": "ECE",
      "year": 3,
      "daily_cap_h": 5,
      "course_ids": [
        102,
        103,
        104
      ],
      "event_ids": [
        "ev2",
        "ev4",
        "ev5"
      ]
    },
    {
      "id": "s4",
      "name": "Daniel",
      "major": "CS",
      "year": 2,
      "daily_cap_h": 7,
      "course_ids": [
        101,
        103
      ],
      "event_ids": [
        "ev1",
        "ev7",
        "ev8"
      ]
    },
    {
      "id": "s5",
      "name": "Sofia",
      "major": "MechE",
      "year": 3,
      "daily_cap_h": 6,
      "course_ids": [
        102,
        103
      ],
      "event_ids": [
        "ev5",
        "ev8"
      ]
    }
  ],
  "campusEvents": [
    {
      "id": "ce1",
      "summary": "Tech & Engineering Career Fair",
      "start": {
        "dateTime": "2026-12-03T12:00:00-05:00"
      },
      "end": {
        "dateTime": "2026-12-03T16:00:00-05:00"
      },
      "host_type": "recruiting",
      "host": "Career Center",
      "location": "Cohon Center"
    },
    {
      "id": "ce2",
      "summary": "Hackathon demo night",
      "start": {
        "dateTime": "2026-12-02T18:00:00-05:00"
      },
      "end": {
        "dateTime": "2026-12-02T20:00:00-05:00"
      },
      "host_type": "general",
      "host": "ScottyLabs",
      "location": "Gates 6115"
    },
    {
      "id": "ce3",
      "summary": "Jane Street info session",
      "start": {
        "dateTime": "2026-12-12T18:00:00-05:00"
      },
      "end": {
        "dateTime": "2026-12-12T19:00:00-05:00"
      },
      "host_type": "recruiting",
      "host": "Jane Street",
      "location": "Tepper 1403"
    },
    {
      "id": "ce4",
      "summary": "Midnight pancake study break",
      "start": {
        "dateTime": "2026-12-13T21:00:00-05:00"
      },
      "end": {
        "dateTime": "2026-12-13T22:00:00-05:00"
      },
      "host_type": "relax",
      "host": "Student Affairs",
      "location": "Resnik"
    },
    {
      "id": "ce5",
      "summary": "Yoga for finals",
      "start": {
        "dateTime": "2026-12-14T17:30:00-05:00"
      },
      "end": {
        "dateTime": "2026-12-14T18:30:00-05:00"
      },
      "host_type": "relax",
      "host": "Wellness Office",
      "location": "CUC Studio"
    },
    {
      "id": "ce6",
      "summary": "Winter formal",
      "start": {
        "dateTime": "2026-12-18T20:00:00-05:00"
      },
      "end": {
        "dateTime": "2026-12-18T23:00:00-05:00"
      },
      "host_type": "general",
      "host": "Student Government",
      "location": "Rangos Ballroom"
    }
  ]
};
