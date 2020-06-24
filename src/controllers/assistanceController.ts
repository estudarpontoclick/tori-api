import { Request, Response, NextFunction } from "express";

import * as assistanceModel from "src/models/assistanceModel";
import * as addressModel from "src/models/addressModel";
import { assistance as Assistance, address as Address } from "src/helpers/dbNamespaceHelper";
import { CustomError, ErrorCode } from "src/helpers/customErrorHelper";
import { QueryOptions, addTags } from "src/helpers/assistanceHelper";
import { parseQueryField, currentDate, notAllowedFieldsSearch, decryptHexId } from "src/helpers/utilHelper";
import { toBoolean } from "src/helpers/conversionHelper";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {

  const { limit, offset, available, order } = req.query;

  const fields = (req as any).fields;

  try {
    const allAssistance = await assistanceModel.getAll({
      limit: Number(limit),
      offset: Number(offset),
      available: Boolean(available),
      order: order as string,
      fields
    });

    return res.json(allAssistance);

  } catch (error) {
    return next(new CustomError({ code: ErrorCode.INTERNAL_ERROR }));
  }
};

export const getByID = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  try {
    const assistance = await assistanceModel.searchByID({ id: Number(id) });

    res.json(assistance);

  } catch (error) {
    return next(new CustomError({ error }));
  }
};

export const searchQuery = async (req: Request, res: Response, next: NextFunction) => {
  const {
    q,
    available,
    limit,
    offset,
    orderBy,
    search,
    filter
  } = req.query;

  const fields = (req as any).fields;

  const searchParsed = parseQueryField(search as string);

  if (q !== QueryOptions.id)
    return next(new CustomError({ code: ErrorCode.BAD_Q_QUERY }));

  try {
    switch (q as string) {
      case QueryOptions.all: {
        const assistance = await assistanceModel.searchByNameTagDescription({
          search: searchParsed,
          fields,
          args: {
            available: available as string,
            limit: Number(limit),
            offset: Number(offset),
            orderBy: orderBy ? JSON.parse(orderBy as string) : undefined,
            filter: filter ? JSON.parse(filter as string) : undefined
          }
        });

        return res.json(assistance);
      }
      case QueryOptions.id: {
        const assistance = await assistanceModel.searchByID({
          id: searchParsed[0],
          fields
        });

        return res.json(assistance);
      }
      case QueryOptions.name: {
        if (searchParsed) {
          const assistance = await assistanceModel.searchByName({
            name: searchParsed[0],
            fields,
            args: {
              available: available as string,
              limit: Number(limit),
              offset: Number(offset),
              orderBy: orderBy ? JSON.parse(orderBy as string) : undefined,
              filter: filter ? JSON.parse(filter as string) : undefined
            }
          });

          return res.json(assistance);
        }
      }
      case QueryOptions.tag: {
        const tagsParsed = parseQueryField(search as string);

        const assistance = await assistanceModel.searchByTag({
          tags: tagsParsed,
          fields,
          args: {
            available: available as string,
            limit: Number(limit),
            offset: Number(offset),
            orderBy: orderBy ? JSON.parse(orderBy as string) : undefined,
            filter: filter ? JSON.parse(filter as string) : undefined
          }
        });
        return res.json(assistance);
      }
      default: {
        return next(new CustomError({
          message: "Query option does not exist.",
          code: ErrorCode.BAD_REQUEST
        }));
      }
    }
  }
  catch (error) {
    return next(new CustomError({ error }));
  }

};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user;

  const {
    available_vacancies,
    course_id,
    date,
    description,
    subject_id,
    title,
    total_vacancies,
    tags,
    cep,
    complement,
    latitude,
    longitude,
    number: addressNumber,
    reference,
    street,
    nickname,
  } = req.body;

  try {
    const newAssistance = await assistanceModel.create({
      available_vacancies,
      course_id: decryptHexId(course_id),
      date,
      description,
      title,
      total_vacancies,
      owner_id: decryptHexId(userId),
    });



    const newAddress = await (async () => {
      try {
        return await addressModel.create({
          cep,
          complement,
          latitude,
          longitude,
          number: addressNumber,
          reference,
          street,
          nickname,
          id: newAssistance.insertId
        });
      } catch (error) {
        return next(new CustomError({ error }));
      }
    })();

    if (newAddress instanceof Error || newAddress === undefined || newAddress.affectedRows === undefined) {
      return next(new CustomError({
        code: ErrorCode.INTERNAL_ERROR,
        message: "An error occurred while creating the address",
      }));
    }

    if (tags && newAssistance.insertId) {
      addTags(newAssistance.insertId, tags);
    }

    res.json({ message: "Assistance created", assistanceId: newAssistance.insertId });
  }
  catch (error) {
    return next(new CustomError({ error }));
  }
};

export const deleteById = async (req: Request, res: Response, next: NextFunction) => {
  const { assistanceId } = req.params;
  try {
    await assistanceModel.deleteById(assistanceId);
    res.json({message: "Assistance deleted successfully"});
  }
  catch (error) {
    return next(new CustomError({
      error,
      message: "An error ocurred while deleting this assistance."
    }));
  }
};

export const disableById = async (req: Request, res: Response, next: NextFunction) => {
  const { assistanceId } = req.params;

  try {
    await assistanceModel.update(assistanceId, {
      available: 0,
      suspended_date: currentDate()
    });

    res.json({ message: "Assistance suspended successfully" });
  }
  catch (error) {
    return next(new CustomError({
      error,
      message: "An error ocurred while disabling this assistance."
    }));
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  const { assistanceId } = req.params;

  const assistanceUpdate = req.body as Assistance & Address;

  try {
    const response = await assistanceModel.update(assistanceId, {
      ...assistanceUpdate, id: undefined
    });

    res.json("Success");
  }
  catch (error) {
    return next(new CustomError({
      error,
      message: "An error occurred while updating this assistance."
    }));
  }
};

export const subscribeUser = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user as number;
  const { assistanceId } = req.params;

  try {
    const assistanceInfo = await assistanceModel.searchByID({
      id: assistanceId,
      fields: ["owner_id", "available_vacancies", "available"]
    });

    if (assistanceInfo === undefined || toBoolean(assistanceInfo.assistance.available) === false)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "This assistance no longer exists",
      }));

    if (assistanceInfo.assistance.owner_id === userId)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "This user can not subscribe onto his own assistance",
      }));

    if (assistanceInfo.assistance.available_vacancies === 0)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "This assistance has no empty vacancies",
      }));

    const isSubscribed = await assistanceModel.findSubscribedAssistanceUserByID({
      userId,
      assistanceId,
      select: ["assistance_presence_list.id"]
    });

    if (isSubscribed !== undefined)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "This user already is subscribed in this assistance",
      }));

    const subscribe = await assistanceModel.subscribeUser({
      assistance_id: assistanceId,
      student_id: userId,
    });

    const updateAssistance = assistanceModel.update(assistanceId, {
      available_vacancies: assistanceInfo.assistance.available_vacancies - 1
    });

    res.json("User subscribed successfully");

  } catch (error) {
    return next(new CustomError({
      error,
      message: "An error occurred while subscribing this user."
    }));
  }

};

export const unsubscribeUser = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user as number;
  const { assistanceId } = req.params;


  try {

    const assistanceInfo = await assistanceModel.searchByID({
      id: assistanceId,
      fields: ["owner_id", "available_vacancies", "available"]
    });

    if (assistanceInfo === undefined || toBoolean(assistanceInfo.assistance.available) === false)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "This assistance no longer exists",
      }));

    if (assistanceInfo.assistance.owner_id === userId)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "This user can not unsubscribe in his own assistance",
      }));


    const result = await assistanceModel.unsubscribeUsersByID({
      userId,
      assistanceId
    });

    if (result === undefined)
      return next(new CustomError({
        code: ErrorCode.INTERNAL_ERROR,
        message: "An error occurred while unsubscribing on assistance",
      }));

    if (result.affectedRows === 0)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "User was not subscribed in this assistance",
      }));

    const updateAssistance = await assistanceModel.update(assistanceId, {
      available_vacancies: assistanceInfo.assistance.available_vacancies + 1
    });

    return res.json({ message: "User unsubscribed successfully" });

  }
  catch (error) {
    return next(new CustomError({
      error,
      message: "An error occurred while creating the the assistance",
    }));
  }
};

export const getSubscribers = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user;
  const { assistanceId } = req.params;

  const fields = (req as any).fields;

  try {
    const assistance = (await assistanceModel.searchByID({
      id: assistanceId,
      fields: ["owner_id"]
    }))?.assistance;

    const user = await assistanceModel.findSubscribedAssistanceUserByID({ userId, assistanceId, select: ["assistance_presence_list.id"] });

    if (user === undefined && userId !== assistance?.owner_id)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "User was not subscribed in this assistance",
      }));

    if (fields === undefined) {
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "Fields must be filled",
      }));
    }

    if (notAllowedFieldsSearch(fields))
      return next(new CustomError({
        code: ErrorCode.UNAUTHORIZED
      }));

    const users = await assistanceModel
      .findAllSubscribedUsers(
        assistanceId,
        fields
      );
    res.json(users);

  } catch (error) {
    return next(new CustomError({
      error,
      message: "An error occurred while getting user in this assistance."
    }));
  }
};

export const assistanceGivePresence = async (req: Request, res: Response, next: NextFunction) => {
  const { userCode } = req.body;
  const { assistanceId } = req.params;

  if (userCode === undefined)
    return next(new CustomError({
      code: ErrorCode.BAD_REQUEST,
      message: "User code is invalid. Send a valid user code."
    }));

  try {
    const response = await assistanceModel.givePresenceToUser(assistanceId, userCode);

    if (response.affectedRows === 0)
      return next(new CustomError({
        code: ErrorCode.BAD_REQUEST,
        message: "User not subscribed on this assistance."
      }));

    res.json({ message: "Presence confirmed successfully" });
  } catch (error) {
    return next(new CustomError({
      code: ErrorCode.INTERNAL_ERROR,
      message: "User not subscribed on this assistance."
    }));
  }
};