// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"io"
	"net/http"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	MAX_ADD_MEMBERS_BATCH = 20
)

func InitTeam() {
	l4g.Debug(utils.T("api.team.init.debug"))

	BaseRoutes.Teams.Handle("", ApiSessionRequired(createTeam)).Methods("POST")
	BaseRoutes.Teams.Handle("", ApiSessionRequired(getAllTeams)).Methods("GET")
	BaseRoutes.Teams.Handle("/search", ApiSessionRequired(searchTeams)).Methods("POST")
	BaseRoutes.TeamsForUser.Handle("", ApiSessionRequired(getTeamsForUser)).Methods("GET")
	BaseRoutes.TeamsForUser.Handle("/unread", ApiSessionRequired(getTeamsUnreadForUser)).Methods("GET")

	BaseRoutes.Team.Handle("", ApiSessionRequired(getTeam)).Methods("GET")
	BaseRoutes.Team.Handle("", ApiSessionRequired(updateTeam)).Methods("PUT")
	BaseRoutes.Team.Handle("", ApiSessionRequired(softDeleteTeam)).Methods("DELETE")
	BaseRoutes.Team.Handle("/patch", ApiSessionRequired(patchTeam)).Methods("PUT")
	BaseRoutes.Team.Handle("/stats", ApiSessionRequired(getTeamStats)).Methods("GET")
	BaseRoutes.TeamMembers.Handle("", ApiSessionRequired(getTeamMembers)).Methods("GET")
	BaseRoutes.TeamMembers.Handle("/ids", ApiSessionRequired(getTeamMembersByIds)).Methods("POST")
	BaseRoutes.TeamMembersForUser.Handle("", ApiSessionRequired(getTeamMembersForUser)).Methods("GET")
	BaseRoutes.TeamMembers.Handle("", ApiSessionRequired(addTeamMember)).Methods("POST")
	BaseRoutes.TeamMembers.Handle("/batch", ApiSessionRequired(addTeamMembers)).Methods("POST")
	BaseRoutes.TeamMember.Handle("", ApiSessionRequired(removeTeamMember)).Methods("DELETE")

	BaseRoutes.TeamForUser.Handle("/unread", ApiSessionRequired(getTeamUnread)).Methods("GET")

	BaseRoutes.TeamByName.Handle("", ApiSessionRequired(getTeamByName)).Methods("GET")
	BaseRoutes.TeamMember.Handle("", ApiSessionRequired(getTeamMember)).Methods("GET")
	BaseRoutes.TeamByName.Handle("/exists", ApiSessionRequired(teamExists)).Methods("GET")
	BaseRoutes.TeamMember.Handle("/roles", ApiSessionRequired(updateTeamMemberRoles)).Methods("PUT")

	BaseRoutes.Team.Handle("/import", ApiSessionRequired(importTeam)).Methods("POST")
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)
	if team == nil {
		c.SetInvalidParam("team")
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_TEAM) {
		c.Err = model.NewAppError("createTeam", "api.team.is_team_creation_allowed.disabled.app_error", nil, "", http.StatusForbidden)
		return
	}

	rteam, err := app.CreateTeamWithUser(team, c.Session.UserId, c.GetSiteURL())
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rteam.ToJson()))
}

func getTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if team, err := app.GetTeam(c.Params.TeamId); err != nil {
		c.Err = err
		return
	} else {
		if team.Type != model.TEAM_OPEN && !app.SessionHasPermissionToTeam(c.Session, team.Id, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		w.Write([]byte(team.ToJson()))
		return
	}
}

func getTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamName()
	if c.Err != nil {
		return
	}

	if team, err := app.GetTeamByName(c.Params.TeamName); err != nil {
		c.Err = err
		return
	} else {
		if team.Type != model.TEAM_OPEN && !app.SessionHasPermissionToTeam(c.Session, team.Id, model.PERMISSION_VIEW_TEAM) {
			c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
			return
		}

		w.Write([]byte(team.ToJson()))
		return
	}
}

func updateTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("team")
		return
	}

	team.Id = c.Params.TeamId

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	updatedTeam, err := app.UpdateTeam(team)

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(updatedTeam.ToJson()))
}

func patchTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team := model.TeamPatchFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("team")
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	patchedTeam, err := app.PatchTeam(c.Params.TeamId, team)

	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	w.Write([]byte(patchedTeam.ToJson()))
}

func softDeleteTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	err := app.SoftDeleteTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getTeamsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.Session.UserId != c.Params.UserId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if teams, err := app.GetTeamsForUser(c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.TeamListToJson(teams)))
	}
}

func getTeamsUnreadForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.Session.UserId != c.Params.UserId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	// optional team id to be excluded from the result
	teamId := r.URL.Query().Get("exclude_team")

	unreadTeamsList, err := app.GetTeamsUnreadForUser(teamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamsUnreadToJson(unreadTeamsList)))
}

func getTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if team, err := app.GetTeamMember(c.Params.TeamId, c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(team.ToJson()))
		return
	}
}

func getTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if members, err := app.GetTeamMembers(c.Params.TeamId, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.TeamMembersToJson(members)))
		return
	}
}

func getTeamMembersForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	members, err := app.GetTeamMembersForUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamMembersToJson(members)))
}

func getTeamMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	members, err := app.GetTeamMembersByIds(c.Params.TeamId, userIds)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamMembersToJson(members)))
}

func addTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var err *model.AppError
	member := model.TeamMemberFromJson(r.Body)
	if member.TeamId != c.Params.TeamId {
		c.SetInvalidParam("team_id")
		return
	}

	hash := r.URL.Query().Get("hash")
	data := r.URL.Query().Get("data")
	inviteId := r.URL.Query().Get("invite_id")

	if len(member.UserId) > 0 {
		if len(member.UserId) != 26 {
			c.SetInvalidParam("user_id")
			return
		}

		if !app.SessionHasPermissionToTeam(c.Session, member.TeamId, model.PERMISSION_ADD_USER_TO_TEAM) {
			c.SetPermissionError(model.PERMISSION_ADD_USER_TO_TEAM)
			return
		}

		member, err = app.AddTeamMember(member.TeamId, member.UserId, c.GetSiteURL())
	} else if len(hash) > 0 && len(data) > 0 {
		member, err = app.AddTeamMemberByHash(c.Session.UserId, hash, data, c.GetSiteURL())
		if err != nil {
			err = model.NewAppError("addTeamMember", "api.team.add_user_to_team.invalid_data.app_error", nil, "", http.StatusNotFound)
		}
	} else if len(inviteId) > 0 {
		member, err = app.AddTeamMemberByInviteId(inviteId, c.Session.UserId, c.GetSiteURL())
		if err != nil {
			err = model.NewAppError("addTeamMember", "api.team.add_user_to_team.invalid_invite_id.app_error", nil, "", http.StatusNotFound)
		}
	} else {
		err = model.NewAppError("addTeamMember", "api.team.add_user_to_team.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(member.ToJson()))
}

func addTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var err *model.AppError
	members := model.TeamMembersFromJson(r.Body)

	if len(members) > MAX_ADD_MEMBERS_BATCH || len(members) == 0 {
		c.SetInvalidParam("too many members in batch")
		return
	}

	var userIds []string
	for _, member := range members {
		if member.TeamId != c.Params.TeamId {
			c.SetInvalidParam("team_id for member with user_id=" + member.UserId)
			return
		}

		if len(member.UserId) != 26 {
			c.SetInvalidParam("user_id")
			return
		}

		userIds = append(userIds, member.UserId)
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_ADD_USER_TO_TEAM) {
		c.SetPermissionError(model.PERMISSION_ADD_USER_TO_TEAM)
		return
	}

	members, err = app.AddTeamMembers(c.Params.TeamId, userIds, c.GetSiteURL())

	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(model.TeamMembersToJson(members)))
}

func removeTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	if c.Session.UserId != c.Params.UserId {
		if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_REMOVE_USER_FROM_TEAM) {
			c.SetPermissionError(model.PERMISSION_REMOVE_USER_FROM_TEAM)
			return
		}
	}

	if err := app.RemoveUserFromTeam(c.Params.TeamId, c.Params.UserId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getTeamUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	unreadTeam, err := app.GetTeamUnread(c.Params.TeamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(unreadTeam.ToJson()))
}

func getTeamStats(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if stats, err := app.GetTeamStats(c.Params.TeamId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(stats.ToJson()))
		return
	}
}

func updateTeamMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJson(r.Body)

	newRoles := props["roles"]
	if !model.IsValidUserRoles(newRoles) {
		c.SetInvalidParam("team_member_roles")
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_TEAM_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM_ROLES)
		return
	}

	if _, err := app.UpdateTeamMemberRoles(c.Params.TeamId, c.Params.UserId, newRoles); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getAllTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	var teams []*model.Team
	var err *model.AppError

	if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		teams, err = app.GetAllTeamsPage(c.Params.Page, c.Params.PerPage)
	} else {
		teams, err = app.GetAllOpenTeamsPage(c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamListToJson(teams)))
}

func searchTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.TeamSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("team_search")
		return
	}

	if len(props.Term) == 0 {
		c.SetInvalidParam("term")
		return
	}

	var teams []*model.Team
	var err *model.AppError

	if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		teams, err = app.SearchAllTeams(props.Term)
	} else {
		teams, err = app.SearchOpenTeams(props.Term)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamListToJson(teams)))
}

func teamExists(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamName()
	if c.Err != nil {
		return
	}

	resp := make(map[string]bool)

	if _, err := app.GetTeamByName(c.Params.TeamName); err != nil {
		resp["exists"] = false
	} else {
		resp["exists"] = true
	}

	w.Write([]byte(model.MapBoolToJson(resp)))
	return
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_IMPORT_TEAM) {
		c.SetPermissionError(model.PERMISSION_IMPORT_TEAM)
		return
	}

	if err := r.ParseMultipartForm(10000000); err != nil {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.parse.app_error", nil, err.Error())
		return
	}

	importFromArray, ok := r.MultipartForm.Value["importFrom"]
	importFrom := importFromArray[0]

	fileSizeStr, ok := r.MultipartForm.Value["filesize"]
	if !ok {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.unavailable.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileSize, err := strconv.ParseInt(fileSizeStr[0], 10, 64)
	if err != nil {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.integer.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfoArray, ok := r.MultipartForm.File["file"]
	if !ok {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.no_file.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileInfoArray) <= 0 {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.array.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfo := fileInfoArray[0]

	fileData, err := fileInfo.Open()
	defer fileData.Close()
	if err != nil {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.open.app_error", nil, err.Error())
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	var log *bytes.Buffer
	switch importFrom {
	case "slack":
		var err *model.AppError
		if err, log = app.SlackImport(fileData, fileSize, c.Params.TeamId); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusBadRequest
		}
	}

	w.Header().Set("Content-Disposition", "attachment; filename=MattermostImportLog.txt")
	w.Header().Set("Content-Type", "application/octet-stream")
	if c.Err != nil {
		w.WriteHeader(c.Err.StatusCode)
	}
	io.Copy(w, bytes.NewReader(log.Bytes()))
}
