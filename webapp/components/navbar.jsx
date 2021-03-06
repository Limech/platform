// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import EditChannelHeaderModal from './edit_channel_header_modal.jsx';
import EditChannelPurposeModal from './edit_channel_purpose_modal.jsx';
import MessageWrapper from './message_wrapper.jsx';
import NotifyCounts from './notify_counts.jsx';
import ChannelInfoModal from './channel_info_modal.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';
import ChannelMembersModal from './channel_members_modal.jsx';
import ChannelNotificationsModal from './channel_notifications_modal.jsx';
import DeleteChannelModal from './delete_channel_modal.jsx';
import RenameChannelModal from './rename_channel_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';
import StatusIcon from './status_icon.jsx';

import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import SearchStore from 'stores/search_store.jsx';

import ChannelSwitchModal from './channel_switch_modal.jsx';

import * as Utils from 'utils/utils.jsx';
import * as ChannelUtils from 'utils/channel_utils.jsx';
import * as ChannelActions from 'actions/channel_actions.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import {getPinnedPosts} from 'actions/post_actions.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';

import {FormattedMessage} from 'react-intl';

import {Popover, OverlayTrigger} from 'react-bootstrap';

import {Link} from 'react-router/es6';

import React from 'react';

export default class Navbar extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.showSearch = this.showSearch.bind(this);

        this.showEditChannelHeaderModal = this.showEditChannelHeaderModal.bind(this);
        this.showRenameChannelModal = this.showRenameChannelModal.bind(this);
        this.hideRenameChannelModal = this.hideRenameChannelModal.bind(this);
        this.isStateValid = this.isStateValid.bind(this);

        this.createCollapseButtons = this.createCollapseButtons.bind(this);
        this.createDropdown = this.createDropdown.bind(this);

        this.showMembersModal = this.showMembersModal.bind(this);
        this.hideMembersModal = this.hideMembersModal.bind(this);

        this.showChannelSwitchModal = this.showChannelSwitchModal.bind(this);
        this.hideChannelSwitchModal = this.hideChannelSwitchModal.bind(this);

        this.openDirectMessageModal = this.openDirectMessageModal.bind(this);
        this.getPinnedPosts = this.getPinnedPosts.bind(this);

        const state = this.getStateFromStores();
        state.showEditChannelPurposeModal = false;
        state.showEditChannelHeaderModal = false;
        state.showMembersModal = false;
        state.showRenameChannelModal = false;
        state.showChannelSwitchModal = false;
        this.state = state;
    }

    getStateFromStores() {
        const channel = ChannelStore.getCurrent();

        return {
            channel,
            member: ChannelStore.getCurrentMember(),
            users: [],
            userCount: ChannelStore.getCurrentStats().member_count,
            currentUser: UserStore.getCurrentUser(),
            isFavorite: channel && ChannelUtils.isFavoriteChannel(channel)
        };
    }

    isStateValid() {
        return this.state.channel && this.state.member && this.state.users && this.state.currentUser;
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        ChannelStore.addStatsChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);
        UserStore.addChangeListener(this.onChange);
        PreferenceStore.addChangeListener(this.onChange);
        $('.inner-wrap').click(this.hideSidebars);
        document.addEventListener('keydown', this.showChannelSwitchModal);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
        ChannelStore.removeStatsChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        UserStore.removeChangeListener(this.onChange);
        PreferenceStore.removeChangeListener(this.onChange);
        document.removeEventListener('keydown', this.showChannelSwitchModal);
    }

    handleSubmit(e) {
        e.preventDefault();
    }

    handleLeave() {
        ChannelActions.leaveChannel(this.state.channel.id);
    }

    hideSidebars(e) {
        var windowWidth = $(window).outerWidth();
        if (windowWidth <= 768) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: null
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_SELECTED,
                postId: null
            });

            if (e.target.className !== 'navbar-toggle' && e.target.className !== 'icon-bar') {
                $('.app__body .inner-wrap').removeClass('move--right move--left move--left-small');
                $('.app__body .sidebar--left').removeClass('move--right');
                $('.multi-teams .team-sidebar').removeClass('move--right');
                $('.app__body .sidebar--right').removeClass('move--left');
                $('.app__body .sidebar--menu').removeClass('move--left');
            }
        }
    }

    toggleLeftSidebar() {
        $('.app__body .inner-wrap').toggleClass('move--right');
        $('.app__body .sidebar--left').toggleClass('move--right');
        $('.multi-teams .team-sidebar').toggleClass('move--right');
    }

    toggleRightSidebar() {
        $('.app__body .inner-wrap').toggleClass('move--left-small');
        $('.app__body .sidebar--menu').toggleClass('move--left');
    }

    showSearch() {
        AppDispatcher.handleServerAction({
            type: ActionTypes.SHOW_SEARCH
        });
    }

    onChange() {
        this.setState(this.getStateFromStores());
    }

    showEditChannelHeaderModal() {
        // this can't be done using a ToggleModalButton because we can't use one inside an OverlayTrigger
        if (this.refs.headerOverlay) {
            this.refs.headerOverlay.hide();
        }

        this.setState({
            showEditChannelHeaderModal: true
        });
    }

    showRenameChannelModal(e) {
        e.preventDefault();

        this.setState({
            showRenameChannelModal: true
        });
    }

    hideRenameChannelModal() {
        this.setState({
            showRenameChannelModal: false
        });
    }

    showMembersModal(e) {
        e.preventDefault();

        this.setState({showMembersModal: true});
    }

    hideMembersModal() {
        this.setState({showMembersModal: false});
    }

    showChannelSwitchModal(e) {
        if (Utils.cmdOrCtrlPressed(e) && e.keyCode === Constants.KeyCodes.K) {
            e.preventDefault();
            this.setState({showChannelSwitchModal: !this.state.showChannelSwitchModal});
        }
    }

    hideChannelSwitchModal() {
        this.setState({
            showChannelSwitchModal: false
        });
    }

    openDirectMessageModal() {
        AppDispatcher.handleViewAction({
            type: ActionTypes.TOGGLE_DM_MODAL,
            value: true,
            startingUsers: UserStore.getProfileListInChannel(this.state.channel.id, true)
        });
    }

    getPinnedPosts(e) {
        e.preventDefault();
        if (SearchStore.isPinnedPosts) {
            GlobalActions.toggleSideBarAction(false);
        } else {
            getPinnedPosts(this.state.channel.id);
        }
    }

    toggleFavorite = (e) => {
        e.preventDefault();

        if (this.state.isFavorite) {
            ChannelActions.unmarkFavorite(this.state.channel.id);
        } else {
            ChannelActions.markFavorite(this.state.channel.id);
        }
    };

    createDropdown(channel, channelTitle, isAdmin, isSystemAdmin, isChannelAdmin, isDirect, isGroup, popoverContent) {
        if (channel) {
            let viewInfoOption;
            let viewPinnedPostsOption;
            let addMembersOption;
            let manageMembersOption;
            let setChannelHeaderOption;
            let setChannelPurposeOption;
            let notificationPreferenceOption;
            let renameChannelOption;
            let deleteChannelOption;
            let leaveChannelOption;

            if (isDirect) {
                setChannelHeaderOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.showEditChannelHeaderModal}
                        >
                            <FormattedMessage
                                id='channel_header.channelHeader'
                                defaultMessage='Set Channel Header...'
                            />
                        </a>
                    </li>
                );
            } else if (isGroup) {
                setChannelHeaderOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.showEditChannelHeaderModal}
                        >
                            <FormattedMessage
                                id='channel_header.channelHeader'
                                defaultMessage='Set Channel Header...'
                            />
                        </a>
                    </li>
                );

                notificationPreferenceOption = (
                    <li role='presentation'>
                        <ToggleModalButton
                            role='menuitem'
                            dialogType={ChannelNotificationsModal}
                            dialogProps={{
                                channel,
                                channelMember: this.state.member,
                                currentUser: this.state.currentUser
                            }}
                        >
                            <FormattedMessage
                                id='navbar.preferences'
                                defaultMessage='Notification Preferences'
                            />
                        </ToggleModalButton>
                    </li>
                );

                addMembersOption = (
                    <li
                        role='presentation'
                    >
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.openDirectMessageModal}
                        >
                            <FormattedMessage
                                id='navbar.addMembers'
                                defaultMessage='Add Members'
                            />
                        </a>
                    </li>
                );
            } else {
                viewInfoOption = (
                    <li role='presentation'>
                        <ToggleModalButton
                            role='menuitem'
                            dialogType={ChannelInfoModal}
                            dialogProps={{channel}}
                        >
                            <FormattedMessage
                                id='navbar.viewInfo'
                                defaultMessage='View Info'
                            />
                        </ToggleModalButton>
                    </li>
                );

                viewPinnedPostsOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.getPinnedPosts}
                        >
                            <FormattedMessage
                                id='navbar.viewPinnedPosts'
                                defaultMessage='View Pinned Posts'
                            />
                        </a>
                    </li>
                );

                if (!ChannelStore.isDefault(channel)) {
                    addMembersOption = (
                        <li role='presentation'>
                            <ToggleModalButton
                                ref='channelInviteModalButton'
                                role='menuitem'
                                dialogType={ChannelInviteModal}
                                dialogProps={{channel, currentUser: this.state.currentUser}}
                            >
                                <FormattedMessage
                                    id='navbar.addMembers'
                                    defaultMessage='Add Members'
                                />
                            </ToggleModalButton>
                        </li>
                    );

                    if (isAdmin) {
                        manageMembersOption = (
                            <li
                                key='manage_members'
                                role='presentation'
                            >
                                <a
                                    role='menuitem'
                                    href='#'
                                    onClick={this.showMembersModal}
                                >
                                    <FormattedMessage
                                        id='channel_header.manageMembers'
                                        defaultMessage='Manage Members'
                                    />
                                </a>
                            </li>
                        );
                    } else {
                        manageMembersOption = (
                            <li
                                key='view_members'
                                role='presentation'
                            >
                                <a
                                    role='menuitem'
                                    href='#'
                                    onClick={this.showMembersModal}
                                >
                                    <FormattedMessage
                                        id='channel_header.viewMembers'
                                        defaultMessage='View Members'
                                    />
                                </a>
                            </li>
                        );
                    }
                }

                notificationPreferenceOption = (
                    <li role='presentation'>
                        <ToggleModalButton
                            role='menuitem'
                            dialogType={ChannelNotificationsModal}
                            dialogProps={{
                                channel,
                                channelMember: this.state.member,
                                currentUser: this.state.currentUser
                            }}
                        >
                            <FormattedMessage
                                id='navbar.preferences'
                                defaultMessage='Notification Preferences'
                            />
                        </ToggleModalButton>
                    </li>
                );

                if (ChannelUtils.showManagementOptions(channel, isAdmin, isSystemAdmin, isChannelAdmin)) {
                    setChannelHeaderOption = (
                        <li role='presentation'>
                            <a
                                role='menuitem'
                                href='#'
                                onClick={this.showEditChannelHeaderModal}
                            >
                                <FormattedMessage
                                    id='channel_header.setHeader'
                                    defaultMessage='Edit Channel Header'
                                />
                            </a>
                        </li>
                    );

                    setChannelPurposeOption = (
                        <li role='presentation'>
                            <a
                                role='menuitem'
                                href='#'
                                onClick={() => this.setState({showEditChannelPurposeModal: true})}
                            >
                                <FormattedMessage
                                    id='channel_header.setPurpose'
                                    defaultMessage='Edit Channel Purpose'
                                />
                            </a>
                        </li>
                    );

                    renameChannelOption = (
                        <li role='presentation'>
                            <a
                                role='menuitem'
                                href='#'
                                onClick={this.showRenameChannelModal}
                            >
                                <FormattedMessage
                                    id='channel_header.rename'
                                    defaultMessage='Rename Channel'
                                />
                            </a>
                        </li>
                    );
                }

                if (ChannelUtils.showDeleteOption(channel, isAdmin, isSystemAdmin, isChannelAdmin) || this.state.userCount === 1) {
                    if (!ChannelStore.isDefault(channel)) {
                        deleteChannelOption = (
                            <li role='presentation'>
                                <ToggleModalButton
                                    role='menuitem'
                                    dialogType={DeleteChannelModal}
                                    dialogProps={{channel}}
                                >
                                    <FormattedMessage
                                        id='channel_header.delete'
                                        defaultMessage='Delete Channel'
                                    />
                                </ToggleModalButton>
                            </li>
                        );
                    }
                }

                const canLeave = channel.type === Constants.PRIVATE_CHANNEL ? this.state.userCount > 1 : true;
                if (!ChannelStore.isDefault(channel) && canLeave) {
                    leaveChannelOption = (
                        <li role='presentation'>
                            <a
                                role='menuitem'
                                href='#'
                                onClick={this.handleLeave}
                            >
                                <FormattedMessage
                                    id='channel_header.leave'
                                    defaultMessage='Leave Channel'
                                />
                            </a>
                        </li>
                    );
                }
            }

            const toggleFavoriteOption = (
                <li
                    key='toggle_favorite'
                    role='presentation'
                >
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.toggleFavorite}
                    >
                        {this.state.isFavorite ?
                            <FormattedMessage
                                id='channelHeader.removeFromFavorites'
                                defaultMessage='Remove from Favorites'
                            /> :
                            <FormattedMessage
                                id='channelHeader.addToFavorites'
                                defaultMessage='Add to Favorites'
                            />}
                    </a>
                </li>
            );

            return (
                <div className='navbar-brand'>
                    <div className='dropdown'>
                        <OverlayTrigger
                            ref='headerOverlay'
                            trigger='click'
                            placement='bottom'
                            overlay={popoverContent}
                            className='description'
                            rootClose={true}
                        >
                            <div className='pull-right description info-popover'/>
                        </OverlayTrigger>
                        <a
                            href='#'
                            className='dropdown-toggle theme'
                            type='button'
                            data-toggle='dropdown'
                            aria-expanded='true'
                        >
                            <span className='heading'><StatusIcon status={this.getTeammateStatus()}/>{channelTitle} </span>
                            <span className='fa fa-chevron-down header-dropdown__icon'/>
                        </a>
                        <ul
                            className='dropdown-menu'
                            role='menu'
                        >
                            {viewInfoOption}
                            {viewPinnedPostsOption}
                            {notificationPreferenceOption}
                            {addMembersOption}
                            {manageMembersOption}
                            {setChannelHeaderOption}
                            {setChannelPurposeOption}
                            {renameChannelOption}
                            {deleteChannelOption}
                            {leaveChannelOption}
                            {toggleFavoriteOption}
                            <div
                                className='close visible-xs-block'
                                onClick={() => this.refs.headerOverlay.hide()}
                            >
                                {'×'}
                            </div>
                        </ul>
                    </div>
                </div>
            );
        }

        return (
            <div className='navbar-brand'>
                <Link
                    to={TeamStore.getCurrentTeamUrl() + '/channels/town-square'}
                    className='heading'
                >
                    {channelTitle}
                </Link>
            </div>
        );
    }

    createCollapseButtons(currentId) {
        var buttons = [];
        if (currentId == null) {
            buttons.push(
                <button
                    key='navbar-toggle-collapse'
                    type='button'
                    className='navbar-toggle'
                    data-toggle='collapse'
                    data-target='#navbar-collapse-1'
                >
                    <span className='sr-only'>
                        <FormattedMessage
                            id='navbar.toggle1'
                            defaultMessage='Toggle sidebar'
                        />
                    </span>
                    <span className='icon-bar'/>
                    <span className='icon-bar'/>
                    <span className='icon-bar'/>
                </button>
            );
        } else {
            buttons.push(
                <button
                    key='navbar-toggle-sidebar'
                    type='button'
                    className='navbar-toggle'
                    data-toggle='collapse'
                    data-target='#sidebar-nav'
                    onClick={this.toggleLeftSidebar}
                >
                    <span className='sr-only'>
                        <FormattedMessage
                            id='navbar.toggle2'
                            defaultMessage='Toggle sidebar'
                        />
                    </span>
                    <span className='icon-bar'/>
                    <span className='icon-bar'/>
                    <span className='icon-bar'/>
                    <NotifyCounts/>
                </button>
            );

            buttons.push(
                <button
                    key='navbar-toggle-menu'
                    type='button'
                    className='navbar-toggle menu-toggle pull-right'
                    data-toggle='collapse'
                    data-target='#sidebar-nav'
                    onClick={this.toggleRightSidebar}
                >
                    <span dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}/>
                </button>
            );
        }

        return buttons;
    }

    getTeammateStatus() {
        const channel = this.state.channel;

        // get status for direct message channels
        if (channel.type === 'D') {
            const currentUserId = this.state.currentUser.id;
            const teammate = this.state.users.find((user) => user.id !== currentUserId);
            if (teammate) {
                return UserStore.getStatus(teammate.id);
            }
        }
        return null;
    }

    render() {
        if (!this.isStateValid()) {
            return null;
        }

        var currentId = this.state.currentUser.id;
        var channel = this.state.channel;
        var channelTitle = this.props.teamDisplayName;
        var popoverContent;
        var isAdmin = false;
        var isSystemAdmin = false;
        var isChannelAdmin = false;
        var isDirect = false;
        let isGroup = false;

        var editChannelHeaderModal = null;
        var editChannelPurposeModal = null;
        let renameChannelModal = null;
        let channelMembersModal = null;
        let channelSwitchModal = null;

        if (channel) {
            popoverContent = (
                <Popover
                    bsStyle='info'
                    placement='bottom'
                    id='header-popover'
                >
                    <MessageWrapper
                        message={channel.header}
                        options={{singleline: true, mentionHighlight: false}}
                    />
                    <div
                        className='close visible-xs-block'
                        onClick={() => this.refs.headerOverlay.hide()}
                    >
                        {'×'}
                    </div>
                </Popover>
            );

            isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
            isSystemAdmin = UserStore.isSystemAdminForCurrentUser();
            isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel();

            if (channel.type === 'O') {
                channelTitle = channel.display_name;
            } else if (channel.type === 'P') {
                channelTitle = channel.display_name;
            } else if (channel.type === 'D') {
                isDirect = true;
                const teammateId = Utils.getUserIdFromChannelName(channel);
                channelTitle = Utils.displayUsername(teammateId);
            } else if (channel.type === Constants.GM_CHANNEL) {
                isGroup = true;
                channelTitle = ChannelUtils.buildGroupChannelName(channel.id);
            }

            if (channel.header.length === 0) {
                const link = (
                    <a
                        href='#'
                        onClick={this.showEditChannelHeaderModal}
                    >
                        <FormattedMessage
                            id='navbar.click'
                            defaultMessage='Click here'
                        />
                    </a>
                );
                popoverContent = (
                    <Popover
                        bsStyle='info'
                        placement='bottom'
                        id='header-popover'
                    >
                        <div>
                            <FormattedMessage
                                id='navbar.noHeader'
                                defaultMessage='No channel header yet.{newline}{link} to add one.'
                                values={{
                                    newline: (<br/>),
                                    link
                                }}
                            />
                        </div>
                        <div
                            className='close visible-xs-block'
                            onClick={() => this.refs.headerOverlay.hide()}
                        >
                            {'×'}
                        </div>
                    </Popover>
                );
            }

            if (this.state.showEditChannelHeaderModal) {
                editChannelHeaderModal = (
                    <EditChannelHeaderModal
                        onHide={() => this.setState({showEditChannelHeaderModal: false})}
                        channel={channel}
                    />
                );
            }

            if (this.state.showEditChannelPurposeModal) {
                editChannelPurposeModal = (
                    <EditChannelPurposeModal
                        onModalDismissed={() => this.setState({showEditChannelPurposeModal: false})}
                        channel={channel}
                    />
                );
            }

            renameChannelModal = (
                <RenameChannelModal
                    show={this.state.showRenameChannelModal}
                    onHide={this.hideRenameChannelModal}
                    channel={channel}
                />
            );

            if (this.state.showMembersModal) {
                channelMembersModal = (
                    <ChannelMembersModal
                        show={true}
                        onModalDismissed={this.hideMembersModal}
                        showInviteModal={() => this.refs.channelInviteModalButton.show()}
                        channel={channel}
                        isAdmin={isAdmin}
                    />
                );
            }

            channelSwitchModal = (
                <ChannelSwitchModal
                    show={this.state.showChannelSwitchModal}
                    onHide={this.hideChannelSwitchModal}
                />
            );
        }

        var collapseButtons = this.createCollapseButtons(currentId);

        const searchButton = (
            <button
                type='button'
                className='navbar-toggle pull-right'
                onClick={this.showSearch}
            >
                <span className='fa fa-search icon-search icon--white'/>
            </button>
        );

        var channelMenuDropdown = this.createDropdown(channel, channelTitle, isAdmin, isSystemAdmin, isChannelAdmin, isDirect, isGroup, popoverContent);

        return (
            <div>
                <nav
                    className='navbar navbar-default navbar-fixed-top'
                    role='navigation'
                >
                    <div className='container-fluid theme'>
                        <div className='navbar-header'>
                            {collapseButtons}
                            {searchButton}
                            {channelMenuDropdown}
                        </div>
                    </div>
                </nav>
                {editChannelHeaderModal}
                {editChannelPurposeModal}
                {renameChannelModal}
                {channelMembersModal}
                {channelSwitchModal}
            </div>
        );
    }
}

Navbar.defaultProps = {
    teamDisplayName: ''
};
Navbar.propTypes = {
    teamDisplayName: React.PropTypes.string
};
