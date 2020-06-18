import DbHelper from "../helpers/dbHelper";
import {
  assistance as Assistance,
  assistance_tag as AssistanceTag,
  assistance_presence_list as AssistancePresenceList,
  user as User,
  address as Address,
  tag as Tag,
  subject as Subject,
  course as Course
} from "../helpers/dbNamespaceHelper";
import { InsertResponse, DeleteResponse } from 'src/helpers/dbResponsesHelper';
import { toBoolean } from 'src/helpers/conversionHelper';
import { decryptHexId, encryptTextHex } from 'src/helpers/utilHelper';

interface AssistanceSearch {
  assistance: Assistance,
  address: Address,
  assistant: User,
  assistanceCourse: Course,
  assistantCourse: Course,
  subject: Subject
}

interface FilterOptions {
  filter?: object,
  limit?: number,
  offset?: number,
  orderBy?: object,
  available?: boolean | string | number
};

export const getAll = async ({ limit, offset, available, order, fields }: { fields: string[] | undefined, order: string, limit: number; offset: number; available: boolean; }) => {
  const db = new DbHelper();

  if (fields?.length)
    fieldSearch({ fields, db })
  else {
    defaultSearch({ db });
  }

  if (order)
    db.orderBy("assistance.id", order);
  else {
    db.orderBy("assistance.id", "DESC");
  }


  if (available !== undefined) {
    if (Boolean(available) === true)
      db.where("available", String(available));
  }

  if (limit !== undefined && offset !== undefined)
    db.pagination(limit, offset);

  try {
    const assistanceList = await db.resolve() as AssistanceSearch[];
    return encryptId(assistanceList);;
  }
  catch (err) {
    throw err;
  }
}

export const searchByID = async ({ id, fields, args }:
  { args?: FilterOptions, fields?: string[], id: number | string; }) => {

  const db = new DbHelper();

  if (fields?.length)
    fieldSearch({ fields, db });
  else
    defaultSearch({ db });

  if (args)
    defaultFilters(args, db);

  db.where("assistance.id", decryptHexId(id));

  try {
    const assistance = await db.resolve() as AssistanceSearch[];

    return assistance.length > 0 ? encryptId(assistance)[0] : undefined;
  }
  catch (err) {
    throw err;
  }
};

export const searchByName = async ({ name, fields, args }:
  { fields?: string[], name: string; args?: FilterOptions; }) => {

  const db = new DbHelper();

  if (fields?.length)
    fieldSearch({ fields, db });
  else
    defaultSearch({ db });

  db.where("assistance.title")
    .like(`%${name}%`);


  if (args)
    defaultFilters(args, db);

  try {
    const assistance = await db.resolve() as AssistanceSearch[];

    return assistance.length > 0 ? assistance : undefined;
  }
  catch (err) {
    throw err;
  }
};

export const searchByTag = async ({ tags, fields, args }:
  { fields?: string[], tags?: string[]; args?: FilterOptions; }) => {

  const db = new DbHelper();

  if (fields?.length)
    fieldSearch({ fields, db });
  else
    defaultSearch({ db });

  db.leftJoin("assistance_tag as at at.assistance_id", "assistance.id")
    .leftJoin("tag.id", "at.id")

  if (tags)
    tags.map((string, i) => {
      if (i == 0)
        db.where("(tag.name")
      else
        db.or("(tag.name")

      db.like(`%${string}%`)
        .or("assistance.title").like(`%${string}%`)
        .or("assistance.description").like(`%${string}%`, ')');
    });


  if (args)
    defaultFilters(args, db);

  try {
    const assistance = await db.resolve() as { assistance: Assistance }[];

    return assistance.map((item: { assistance: Assistance }) => item.assistance);
  }
  catch (err) {
    throw err;
  }
};

export const searchByNameTagDescription = async ({ search, fields, args }:
  { fields?: string[], search: string[] | undefined; args?: FilterOptions; }) => {

  const db = new DbHelper();

  if (fields?.length)
    fieldSearch({ fields, db });
  else
    defaultSearch({ db });

  db.leftJoin("assistance_tag as at at.assistance_id", "assistance.id")
    .leftJoin("tag.id", "at.id")

  if (search)
    search.map((string, i) => {
      if (i == 0)
        db.where("(tag.name")
      else
        db.or("(tag.name")

      db.like(`%${string}%`)
        .or("assistance.title").like(`%${string}%`)
        .or("assistance.description").like(`%${string}%`, ')');

    });

  if (args)
    defaultFilters(args, db);

  try {
    const assistance = await db.resolve() as AssistanceSearch[];

    return assistance;
  }
  catch (err) {
    throw err;
  }
};

export const deleteById = async (id: number | string) => {
  const db = new DbHelper();

  db.delete("assistance")
    .where("id", decryptHexId(id));

  try {
    return db.resolve();
  }
  catch (err) {
    throw err;
  }
};

export const create = async (assistanceData: Assistance | Object): Promise<InsertResponse> => {
  const db = new DbHelper();

  try {
    const newAssistance = await db.insert("assistance", assistanceData).resolve() as InsertResponse[];
    return newAssistance[0];
  }
  catch (err) {
    throw err;
  }
};

export const update = async (assistanceId: number | string, assistanceFields: Assistance | Object) => {
  const db = new DbHelper();

  try {
    const result = await
      db.update("assistance", assistanceFields)
        .where("id", decryptHexId(assistanceId))
        .resolve();

    return result;
  } catch (err) {
    throw err;
  }
};

export const createTag = async (assistanceTag: AssistanceTag | Object): Promise<InsertResponse> => {
  const db = new DbHelper();

  try {
    const newTag = await db.insert("assistance_tag", assistanceTag).resolve() as InsertResponse;
    return newTag;
  }
  catch (err) {
    throw err;
  }
};

export const subscribeUser = async (presenceList: AssistancePresenceList | any): Promise<InsertResponse> => {
  const db = new DbHelper();

  try {
    const newPresenceList = await db
      .insert("assistance_presence_list", {
        assistance_id: decryptHexId(presenceList.assistance_id),
        student_id: decryptHexId(presenceList.student_id)
      } as AssistancePresenceList)
      .resolve() as InsertResponse;
    return newPresenceList;
  }
  catch (err) {
    throw err;
  }
};

export const findAllSubscribedUsers = async (assistanceId: number | string, select: string) => {
  const db = new DbHelper();

  try {
    const res = await db
      .select(select)
      .from("assistance_presence_list")
      .join("user.id", "assistance_presence_list.student_id")
      .where("assistance_presence_list.assistance_id", decryptHexId(assistanceId))
      .resolve() as { user: User, assistance_presence_list: AssistancePresenceList }[];

    return res.length > 0 ? [...res] : undefined;
  }
  catch (err) {
    throw err;
  }
};

export const findSubscribedUsersByID = async ({ userId, assistanceId, select, args }: { args?: FilterOptions, select?: string[], userId: number | string; assistanceId: number | string; }) => {
  const db = new DbHelper();

  db.join("assistance.id", "assistance_presence_list.assistance_id")

  if (select?.length)
    fieldSearch({ fields: select, db, from: "assistance_presence_list" });
  else
    defaultSearch({ db, from: "assistance_presence_list" });

  if (args)
    defaultFilters(args, db);


  try {
    const user = await db
      .where("assistance_presence_list.student_id", decryptHexId(userId))
      .and("assistance_presence_list.assistance_id", decryptHexId(assistanceId))
      .resolve() as { assistance_presence_list: AssistancePresenceList }[];

    return user.length > 0 ? user[0] : undefined;
  }
  catch (err) {
    throw err;
  }
};

export const unsubscribeUsersByID = async ({ userId, assistanceId }: { userId: number | string; assistanceId: number | string; }) => {
  const db = new DbHelper();

  try {
    const user = await db
      .delete("assistance_presence_list")
      .where("student_id", decryptHexId(userId))
      .and("assistance_id", decryptHexId(assistanceId))
      .resolve() as DeleteResponse[];

    return user.length > 0 ? user[0] : undefined;
  }
  catch (err) {
    throw err;
  }
};

export const editSubscribedUsersByID = async ({ userId, assistanceId, fields }: { fields: AssistancePresenceList | object, userId: number | string; assistanceId: number | string; }) => {
  const db = new DbHelper();

  try {
    const result = await db.update("assistance_presence_list", fields)
      .where("assistance_presence_list.student_id", decryptHexId(userId))
      .and("assistance_presence_list.assistance_id", decryptHexId(assistanceId))
      .resolve();

    return result;
  }
  catch (err) {
    throw err;
  }
};

export const givePresenceToUser = async (assistanceId: string | number, userId: string | number) => {

  try {
    return (await editSubscribedUsersByID({
      assistanceId,
      userId,

      fields: {
        student_presence: true
      }
    }))[0] as InsertResponse;
  } catch (error) {
    throw error;
  }
};

export const findAllSubscribedAssistanceByUser = async ({ args, userId, select }: { args?: FilterOptions, userId: number; select?: string[]; }) => {
  const db = new DbHelper();

  db.join("assistance.id", "assistance_presence_list.assistance_id")

  if (select?.length)
    fieldSearch({ fields: select, db, from: "assistance_presence_list" });
  else
    defaultSearch({ db, from: "assistance_presence_list" });

  if (args)
    defaultFilters(args, db);

  try {
    const res = await db
      .where("assistance_presence_list.student_id", decryptHexId(userId))
      .resolve() as { user: User, assistance_presence_list: AssistancePresenceList }[];


    return [...res];
  }
  catch (err) {
    throw err;
  }
};

export const findAllCreatedAssistanceByUser = async ({ userId, select, args }: { args?: FilterOptions, userId: number; select?: string[]; }) => {
  const db = new DbHelper();

  if (select?.length)
    fieldSearch({ fields: select, db });
  else
    defaultSearch({ db });

  if (args)
    defaultFilters(args, db);

  try {
    const res = await db
      .where("assistance.owner_id", decryptHexId(userId))
      .resolve() as { user: User, assistance_presence_list: AssistancePresenceList }[];

    return [...res];
  }
  catch (err) {
    throw err;
  }
};

const fieldSearch = ({ fields, db, from }: { from?: string, fields: string[]; db: DbHelper; }) => {
  const fieldsString = fields.join(",");
  db.select(fieldsString);

  if (from)
    db.from(from);
  else
    db.from("assistance");


  const address = fieldsString.search("address.");
  const assistant = fieldsString.search("assistant.");
  const assistanceCourse = fieldsString.search("assistanceCourse.");
  const assistantCourse = fieldsString.search("assistantCourse.");
  const subject = fieldsString.search("subject.");

  if (assistant >= 0)
    db.join("assistance.owner_id", "user as assistant assistant.id");
  if (assistanceCourse >= 0)
    db.leftJoin("assistance.course_id", "course as assistanceCourse assistanceCourse.id");
  if (assistantCourse >= 0)
    db.leftJoin("assistant.course_id", "course as assistantCourse assistantCourse.id");
  if (address >= 0)
    db.leftJoin("address.assistance_id", "assistance.id");
  if (subject >= 0)
    db.leftJoin("subject.course_id", "assistanceCourse.id");

  return db;
};

const defaultSearch = ({ db, from }: { db: DbHelper; from?: string; }) => {
  if (from)
    db.from(from);
  else
    db.from("assistance");

  db.
    select(`
        assistance.*,
        assistant.id,
        assistant.full_name,
        assistant.created_at,
        assistant.assistant_stars,
        assistant.email,
        assistant.verified_assistant,
        assistanceCourse.name,
        assistanceCourse.description,
        assistanceCourse.id,
        assistantCourse.id,
        assistantCourse.name,
        assistantCourse.description,
        subject.id,
        subject.name,
        subject.description,
        address.*
    `)

    .join("assistance.owner_id", "user as assistant assistant.id")
    .leftJoin("assistance.course_id", "course as assistanceCourse assistanceCourse.id")
    .leftJoin("assistant.course_id", "course as assistantCourse assistantCourse.id")
    .leftJoin("address.assistance_id", "assistance.id")
    .leftJoin("subject.course_id", "assistanceCourse.id");

  return db;
};

const defaultFilters = (args: FilterOptions, db: DbHelper) => {
  if (args.limit && args.offset)
    db.pagination(args.limit, args.offset);

  if (args.filter) {
    for (const key in args.filter) {
      const value = args.filter[key as keyof typeof args.filter];

      db.and(key, value);
    }
  }

  if (args.available) {
    if (toBoolean(args.available.toString())) {
      db.and("assistance.available", "1");
    }
    else {
      db.and("assistance.available", "0");
    }

  }

  if (args.orderBy) {
    for (const key in args.orderBy) {
      const value = args.orderBy[key as keyof typeof args.orderBy];
      db.orderBy(key, value);
      break;
    }
  }
};

const encryptId = (list: AssistanceSearch[]) => {
  return list.map(item => {
    const newItem = { ...item };

    if (item.assistance?.id) {
      const encryptedAssistanceId = encryptTextHex(item.assistance.id);
      newItem.assistance.id = encryptedAssistanceId;
    }


    if (item.assistance?.owner_id) {
      const encryptedOwnerId = encryptTextHex(item.assistance.owner_id);
      newItem.assistance.owner_id = encryptedOwnerId;
    }


    if (item.assistance?.course_id) {
      const encryptedCourseId = encryptTextHex(item.assistance.course_id);
      newItem.assistance.course_id = encryptedCourseId;
    }


    if (item.assistant?.id) {
      const encryptedAssistantId = encryptTextHex(item.assistant.id);
      newItem.assistant.id = encryptedAssistantId;
    }

    if (item.assistantCourse?.id) {
      const encryptedAssistantCourseId = encryptTextHex(item.assistantCourse.id);
      newItem.assistantCourse.id = encryptedAssistantCourseId;
    }


    if (item.assistanceCourse?.id) {
      const encryptedAssistanceCourseId = encryptTextHex(item.assistanceCourse.id);
      newItem.assistanceCourse.id = encryptedAssistanceCourseId;
    }


    if (item.subject?.id) {
      const encryptedSubjectId = encryptTextHex(item.subject.id);
      newItem.subject.id = encryptedSubjectId;
    }


    if (item.address?.id) {
      const encryptedAddressId = encryptTextHex(item.address.id);
      newItem.address.id = encryptedAddressId;
    }


    if (item.address?.assistance_id) {
      const encryptedAddressAssistanceId = encryptTextHex(item.address.assistance_id);
      newItem.address.id = encryptedAddressAssistanceId;
    }

    return newItem;
  });
}