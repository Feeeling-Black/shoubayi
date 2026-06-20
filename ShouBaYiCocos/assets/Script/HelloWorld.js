"use strict";
cc._RF.push(module, '280c3rsZJJKnZ9RqbALVwtK', 'HelloWorld');
// Script/HelloWorld.js

"use strict";

cc._RF.push(module, '280c3rsZJJKnZ9RqbALVwtK', 'HelloWorld');
// Script/HelloWorld.js

"use strict";
var ShouBaYiRuleCore = require('ShouBaYiRuleCore');
cc.Class({
  "extends": cc.Component,
  properties: {
    label: {
      "default": null,
      type: cc.Label
    },
    text: 'ShouBaYi'
  },
  onLoad: function onLoad() {
    if (cc.debug && cc.debug.setDisplayStats) cc.debug.setDisplayStats(false);
    this.seats = ['A', 'B', 'C', 'D'];
    this.ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    this.suits = ['S', 'H', 'C', 'D'];
    this.sequenceRanks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.basePower = {};
    for (var i = 0; i < this.sequenceRanks.length; i += 1) {
      this.basePower[this.sequenceRanks[i]] = i + 1;
    }
    this.selectedIds = {};
    this.handHitBoxes = [];
    this.handCardNodes = {};
    this.dragSelectState = null;
    this.logLines = [];
    this.isBotToMeRunning = false;
    this.deferRender = false;
    this.isDealing = false;
    this.dealVisibleHandCount = 0;
    this.dealAnimationLayer = null;
    this.afterDealCallbacks = [];
    this.buildScene();
    this.startGame();
  },
  buildScene: function buildScene() {
    var children = this.node.children.slice();
    for (var i = 0; i < children.length; i += 1) {
      if (children[i].name !== 'Main Camera') {
        children[i].destroy();
      }
    }
    this.node.color = cc.color(44, 127, 203);
    this.root = this.makeNode('GameRoot', 0, 0, 960, 640, this.node);
    this.fallbackBackground = this.makeNode('FallbackBackground', 0, 0, 960, 640, this.root);
    this.fallbackBackground.zIndex = -20;
    this.drawScenicBackground(this.fallbackBackground);
    this.loadTableBackground();
    this.topBar = this.makeNode('TopBar', 0, 292, 760, 36, this.root);
    this.drawTopStatusBar(this.topBar, 760, 36);
    this.titleLabel = this.makeLabel('', -322, 0, 16, cc.color(226, 238, 255), this.topBar);
    this.titleLabel.node.anchorX = 0;
    this.subtitleLabel = this.makeLabel('', -168, 0, 18, cc.color(226, 238, 255), this.topBar);
    this.subtitleLabel.node.anchorX = 0;
    this.statusLabel = this.makeLabel('', -36, 0, 18, cc.color(255, 236, 166), this.topBar);
    this.actionLabel = this.makeLabel('', 86, 0, 18, cc.color(255, 233, 38), this.topBar);
    this.levelBadge = this.makeLabel('', 0, 0, 1, cc.color(255, 255, 255), this.topBar);
    this.teamABadge = this.makeNode('TeamAStatus', 228, 0, 100, 26, this.topBar);
    this.drawTopTeamPill(this.teamABadge, 100, 26, 'blue');
    this.teamALabel = this.makeLabel('', 0, 0, 17, cc.color(238, 247, 255), this.teamABadge);
    this.teamBBadge = this.makeNode('TeamBStatus', 328, 0, 100, 26, this.topBar);
    this.drawTopTeamPill(this.teamBBadge, 100, 26, 'red');
    this.teamBLabel = this.makeLabel('', 0, 0, 17, cc.color(255, 238, 238), this.teamBBadge);
    this.tableNode = this.makeNode('Table', 0, -4, 1040, 430, this.root);
    this.centerPanel = this.makeNode('CenterPanel', 0, 54, 430, 78, this.tableNode);
    this.drawCenterGuide(this.centerPanel);
    this.centerTitleLabel = this.makeLabel('', 0, 22, 15, cc.color(226, 245, 220), this.centerPanel);
    this.centerLabel = this.makeLabel('', 0, -2, 20, cc.color(255, 248, 220), this.centerPanel);
    this.centerLabel.lineHeight = 28;
    this.centerTipLabel = this.makeLabel('', 0, -28, 12, cc.color(192, 222, 202), this.centerPanel);
    this.tablePlayLayers = {
      A: this.makeNode('TableCards_A', 0, -66, 340, 74, this.tableNode),
      B: this.makeNode('TableCards_B', 264, 4, 270, 74, this.tableNode),
      C: this.makeNode('TableCards_C', 0, 102, 340, 74, this.tableNode),
      D: this.makeNode('TableCards_D', -264, 4, 270, 74, this.tableNode)
    };
    this.tablePlayLayers.A.zIndex = 30;
    this.tablePlayLayers.B.zIndex = 30;
    this.tablePlayLayers.C.zIndex = 30;
    this.tablePlayLayers.D.zIndex = 30;
    this.tablePlaySignatures = {
      A: '',
      B: '',
      C: '',
      D: ''
    };
    this.seatNodes = {
      A: this.makeSeatNode('A（你）', -410, -158, 'bottom'),
      B: this.makeSeatNode('B（电脑）', 382, 86, 'right'),
      C: this.makeSeatNode('C（电脑）', -54, 184, 'top'),
      D: this.makeSeatNode('D（电脑）', -382, 86, 'left')
    };
    this.seatNodes.A.zIndex = 10;
    this.seatNodes.B.zIndex = 10;
    this.seatNodes.C.zIndex = 10;
    this.seatNodes.D.zIndex = 10;
    this.buttonLayer = this.makeNode('Buttons', 84, -116, 790, 58, this.root);
    this.playSelectedButton = this.makeButton('出牌', -224, 0, this.buttonLayer, this.onPlaySelected.bind(this), cc.color(239, 134, 21), 130, 'orange', true);
    this.playSmallButton = this.makeButton('提示', -52, 0, this.buttonLayer, this.onPlaySmall.bind(this), cc.color(34, 130, 228), 130, 'blue', true);
    this.passButton = this.makeButton('不要', 120, 0, this.buttonLayer, this.onPass.bind(this), cc.color(173, 91, 22), 130, 'brown', true);
    this.botButton = this.makeButton('电脑走到我', 306, 0, this.buttonLayer, this.onBotToMe.bind(this), cc.color(128, 156, 134), 150, 'gray');
    this.nextRoundButton = this.makeButton('下一局', 306, 0, this.buttonLayer, this.onNextRound.bind(this), cc.color(239, 134, 21), 142, 'orange');
    this.handStatusBar = this.makeNode('HandStatusBar', 84, -174, 700, 30, this.root);
    this.drawRect(this.handStatusBar, 700, 30, cc.color(8, 35, 34, 120), 14, cc.color(255, 217, 112, 55));
    this.selectionLabel = this.makeLabel('', -330, 0, 14, cc.color(255, 241, 168), this.handStatusBar);
    this.selectionLabel.node.anchorX = 0;
    this.hintLabel = this.makeLabel('', 330, 0, 13, cc.color(218, 235, 252), this.handStatusBar);
    this.hintLabel.horizontalAlign = cc.Label.HorizontalAlign.RIGHT;
    this.hintLabel.node.anchorX = 1;
    this.handTitleLabel = this.makeLabel('', -440, -218, 18, cc.color(255, 248, 220), this.root);
    this.handTitleLabel.node.anchorX = 0;
    this.handCountLabel = this.makeLabel('', 440, -218, 14, cc.color(218, 235, 252), this.root);
    this.handCountLabel.horizontalAlign = cc.Label.HorizontalAlign.RIGHT;
    this.handCountLabel.node.anchorX = 1;
    this.handLayer = this.makeNode('HandLayer', 0, -250, 930, 118, this.root);
    this.logPanel = this.makeNode('LogPanel', 0, -306, 920, 28, this.root);
    this.drawRect(this.logPanel, 920, 28, cc.color(9, 38, 43, 120), 12);
    this.logLabel = this.makeLabel('', -445, 0, 14, cc.color(255, 232, 154), this.logPanel);
    this.logLabel.node.anchorX = 0;
    this.logLabel.lineHeight = 18;
    this.logPanel.active = false;
    this.toastNode = this.makeNode('Toast', 0, 18, 320, 48, this.root);
    this.toastNode.zIndex = 900;
    this.drawRect(this.toastNode, 320, 48, cc.color(0, 0, 0, 170), 18, cc.color(255, 217, 112));
    this.toastLabel = this.makeLabel('', 0, 0, 18, cc.color(255, 248, 220), this.toastNode);
    this.toastNode.active = false;
    this.turnNoticeNode = this.makeNode('TurnNotice', 0, 52, 360, 46, this.root);
    this.turnNoticeNode.zIndex = 910;
    this.drawRect(this.turnNoticeNode, 360, 46, cc.color(8, 38, 42, 190), 18, cc.color(255, 217, 112));
    this.turnNoticeLabel = this.makeLabel('', 0, 0, 20, cc.color(255, 246, 178), this.turnNoticeNode);
    this.turnNoticeNode.active = false;
    this.modalLayer = this.makeNode('ModalLayer', 0, 0, 960, 640, this.root);
    this.modalLayer.zIndex = 1000;
    this.modalLayer.active = false;
    this.buildLayoutDebugPanel();
  },
  makeSeatNode: function makeSeatNode(title, x, y, layout) {
    var node = this.makeNode(title, x, y, 240, 150, this.tableNode);
    node._layout = layout || 'left';
    var cfg = {
      bottom: {
        avatarX: 4,
        avatarY: 14,
        infoX: 10,
        infoY: -74,
        infoW: 142,
        infoH: 82,
        nameX: 4,
        nameY: -50,
        teamX: 4,
        teamY: -86,
        teamScale: 1.12,
        countX: 8,
        countY: -104,
        oneX: 8,
        oneY: -104,
        passX: 58,
        passY: 8,
        scale: 0.84,
        avatarFrame: 'ui/Avatar-frame（256）',
        avatarFill: 'ui/avatar-fill'
      },
      left: {
        avatarX: -32,
        avatarY: 2,
        infoX: 44,
        infoY: 0,
        nameX: 68,
        nameY: 22,
        teamX: 68,
        teamY: -16,
        teamScale: 1.04,
        countX: 56,
        countY: -42,
        oneX: 150,
        oneY: 6,
        passX: 56,
        passY: -70,
        scale: 0.82,
        avatarFrame: 'ui/Avatar-frame-2(256)',
        avatarFill: 'ui/avatar-fill-2'
      },
      right: {
        avatarX: 28,
        avatarY: 2,
        infoX: -44,
        infoY: 0,
        nameX: -68,
        nameY: 22,
        teamX: -68,
        teamY: -16,
        teamScale: 0.96,
        countX: -56,
        countY: -42,
        oneX: -150,
        oneY: 6,
        passX: -56,
        passY: -70,
        scale: 0.78,
        avatarFrame: 'ui/Avatar-frame-2(256)',
        avatarFill: 'ui/avatar-fill-2'
      },
      top: {
        avatarX: -34,
        avatarY: 14,
        infoX: 58,
        infoY: 10,
        nameX: 66,
        nameY: 34,
        teamX: 66,
        teamY: -4,
        teamScale: 1.04,
        countX: 62,
        countY: -42,
        oneX: 174,
        oneY: 34,
        passX: 62,
        passY: -72,
        scale: 0.8,
        avatarFrame: 'ui/Avatar-frame-2(256)',
        avatarFill: 'ui/avatar-fill-2'
      }
    }[layout || 'left'];
    var infoW = cfg.infoW || 170;
    var infoH = cfg.infoH || 86;
    var infoPanel = this.makeNode('SeatInfo', cfg.infoX, cfg.infoY, infoW, infoH, node);
    infoPanel._infoW = infoW;
    infoPanel._infoH = infoH;
    this.drawRect(infoPanel, infoW, infoH, cc.color(5, 28, 22, 128), 0);
    var avatar = this.makeNode('Avatar', cfg.avatarX, cfg.avatarY, 124, 124, node);
    var base = this.makeNode('AvatarBase', 0, 0, 124, 124, avatar);
    base.zIndex = 0;
    this.drawCircle(base, 45, cc.color(0, 0, 0, 255));
    var fill = this.makeNode('AvatarFill', 0, 0, 110, 110, avatar);
    fill.zIndex = 4;
    if (cfg.avatarFill) {
      this.loadAvatarFillSprite(fill, cfg.avatarFill);
    }
    node._avatarBaseScale = cfg.scale;
    avatar.scale = node._avatarBaseScale;
    if (cfg.avatarFrame) {
      this.loadAvatarFrameSprite(avatar, cfg.avatarFrame);
    }
    var avatarText = this.makeLabel(title.charAt(0), 0, 0, 26, cc.color(74, 45, 18), avatar);
    avatarText.enableBold = true;
    avatarText.node.zIndex = 10;
    avatar._letterLabel = avatarText;
    var pulseRing = this.makeNode('AvatarPulseRing', 0, 0, 128, 128, avatar);
    pulseRing.zIndex = 3;
    this.drawCircle(pulseRing, 50, cc.color(255, 224, 91, 58));
    pulseRing.active = false;
    var nameLabel = this.makeLabel(title, cfg.nameX, cfg.nameY, 17, cc.color(255, 248, 220), node);
    nameLabel.enableBold = true;
    var teamNode = this.makeNode('TeamBadge', cfg.teamX, cfg.teamY, 82, 24, node);
    teamNode.scale = cfg.teamScale || 1;
    teamNode._teamBaseScale = cfg.teamScale || 1;
    var countLabel = this.makeLabel('', cfg.countX, cfg.countY, 15, cc.color(255, 231, 151), node);
    var oneCardTip = this.makeOneCardTip(cfg.oneX, cfg.oneY, node);
    oneCardTip.active = false;
    var passTip = this.makeLabel('不要', cfg.passX, cfg.passY, 16, cc.color(255, 248, 220), node);
    passTip.node.setContentSize(66, 28);
    passTip.node.zIndex = 80;
    this.drawGlossyRect(passTip.node, 66, 28, cc.color(188, 45, 30, 235), cc.color(255, 117, 75, 86), 8, cc.color(255, 218, 119));
    passTip.node.active = false;
    node._infoPanel = infoPanel;
    node._avatarNode = avatar;
    node._avatarBaseNode = base;
    node._avatarFillNode = fill;
    node._avatarPulseRing = pulseRing;
    node._avatarLetter = title.charAt(0);
    node._nameLabel = nameLabel;
    node._countLabel = countLabel;
    node._oneCardTip = oneCardTip;
    node._teamNode = teamNode;
    node._passTip = passTip;
    node._layoutParts = {
      info: infoPanel,
      avatar: avatar,
      name: nameLabel.node,
      team: teamNode,
      count: countLabel.node
    };
    return node;
  },
  buildLayoutDebugPanel: function buildLayoutDebugPanel() {
    this.layoutDebug = {
      seat: 'A',
      part: 'avatar',
      step: 4
    };
    var panel = this.makeNode('LayoutDebugPanel', 392, 70, 150, 342, this.root);
    panel.zIndex = 850;
    panel.active = false;
    this.drawRect(panel, 150, 342, cc.color(8, 30, 38, 178), 10, cc.color(255, 232, 150, 90));
    this.debugPanel = panel;
    this.debugTitleLabel = this.makeLabel('', 0, 148, 13, cc.color(255, 241, 168), panel);
    var seats = ['A', 'B', 'C', 'D'];
    for (var i = 0; i < seats.length; i += 1) {
      this.makeDebugButton(seats[i], -54 + i * 36, 118, 30, panel, this.setDebugSeat.bind(this, seats[i]));
    }
    this.makeDebugButton('底板', -42, 84, 58, panel, this.setDebugPart.bind(this, 'info'));
    this.makeDebugButton('头像', 42, 84, 58, panel, this.setDebugPart.bind(this, 'avatar'));
    this.makeDebugButton('名字', -42, 52, 58, panel, this.setDebugPart.bind(this, 'name'));
    this.makeDebugButton('队伍', 42, 52, 58, panel, this.setDebugPart.bind(this, 'team'));
    this.makeDebugButton('牌数', 0, 20, 58, panel, this.setDebugPart.bind(this, 'count'));
    this.makeDebugButton('上', 0, -13, 42, panel, this.moveDebugPart.bind(this, 0, this.layoutDebug.step));
    this.makeDebugButton('左', -48, -46, 42, panel, this.moveDebugPart.bind(this, -this.layoutDebug.step, 0));
    this.makeDebugButton('右', 48, -46, 42, panel, this.moveDebugPart.bind(this, this.layoutDebug.step, 0));
    this.makeDebugButton('下', 0, -79, 42, panel, this.moveDebugPart.bind(this, 0, -this.layoutDebug.step));
    this.makeDebugButton('缩小', -42, -110, 58, panel, this.scaleDebugAvatar.bind(this, -0.04));
    this.makeDebugButton('放大', 42, -110, 58, panel, this.scaleDebugAvatar.bind(this, 0.04));
    this.makeDebugButton('显示JSON', 0, -145, 96, panel, this.printDebugLayout.bind(this));
    this.refreshDebugPanel();
  },
  makeDebugButton: function makeDebugButton(text, x, y, width, parent, handler) {
    var node = this.makeNode('DebugButton_' + text, x, y, width, 26, parent);
    this.drawGlossyRect(node, width, 26, cc.color(31, 91, 116, 220), cc.color(255, 255, 255, 32), 8, cc.color(255, 232, 150, 100));
    var label = this.makeLabel(text, 0, 0, 13, cc.color(255, 248, 220), node);
    label.lineHeight = 16;
    node.on(cc.Node.EventType.TOUCH_END, handler, this);
    return node;
  },
  setDebugSeat: function setDebugSeat(seat) {
    this.layoutDebug.seat = seat;
    this.refreshDebugPanel();
  },
  setDebugPart: function setDebugPart(part) {
    this.layoutDebug.part = part;
    this.refreshDebugPanel();
  },
  selectedDebugNode: function selectedDebugNode() {
    var seatNode = this.seatNodes && this.seatNodes[this.layoutDebug.seat];
    if (!seatNode || !seatNode._layoutParts) return null;
    return seatNode._layoutParts[this.layoutDebug.part] || null;
  },
  moveDebugPart: function moveDebugPart(dx, dy) {
    var node = this.selectedDebugNode();
    if (!node) return;
    node.x += dx;
    node.y += dy;
    this.refreshDebugPanel();
  },
  scaleDebugAvatar: function scaleDebugAvatar(delta) {
    var seatNode = this.seatNodes && this.seatNodes[this.layoutDebug.seat];
    if (!seatNode || this.layoutDebug.part !== 'avatar' && this.layoutDebug.part !== 'team') {
      this.showToast('先选择头像或队伍');
      return;
    }
    if (this.layoutDebug.part === 'team') {
      var teamNode = seatNode._teamNode;
      teamNode._teamBaseScale = Math.max(0.2, Math.min(2, (teamNode._teamBaseScale || 1) + delta));
      teamNode.scale = teamNode._teamBaseScale;
      this.refreshDebugPanel();
    }
    seatNode._avatarBaseScale = Math.max(0.2, Math.min(1.8, (seatNode._avatarBaseScale || 1) + delta));
    seatNode._avatarNode.scale = seatNode._avatarBaseScale;
    this.refreshDebugPanel();
  },
  refreshDebugPanel: function refreshDebugPanel() {
    if (!this.debugTitleLabel) return;
    var node = this.selectedDebugNode();
    var pos = node ? ' x:' + Math.round(node.x) + ' y:' + Math.round(node.y) : '';
    var scale = '';
    if (this.layoutDebug.part === 'avatar') {
      var seatNode = this.seatNodes[this.layoutDebug.seat];
      scale = ' s:' + (seatNode._avatarBaseScale || 1).toFixed(2);
    } else if (this.layoutDebug.part === 'team') {
      var teamSeatNode = this.seatNodes[this.layoutDebug.seat];
      scale = ' s:' + (teamSeatNode._teamNode._teamBaseScale || 1).toFixed(2);
    }
    this.debugTitleLabel.string = this.layoutDebug.seat + ' / ' + this.layoutDebug.part + pos + scale;
  },
  printDebugLayout: function printDebugLayout() {
    var data = {};
    for (var i = 0; i < this.seats.length; i += 1) {
      var seat = this.seats[i];
      var seatNode = this.seatNodes[seat];
      data[seat] = {
        avatarX: Math.round(seatNode._avatarNode.x),
        avatarY: Math.round(seatNode._avatarNode.y),
        avatarScale: Number((seatNode._avatarBaseScale || 1).toFixed(2)),
        infoX: Math.round(seatNode._infoPanel.x),
        infoY: Math.round(seatNode._infoPanel.y),
        nameX: Math.round(seatNode._nameLabel.node.x),
        nameY: Math.round(seatNode._nameLabel.node.y),
        teamX: Math.round(seatNode._teamNode.x),
        teamY: Math.round(seatNode._teamNode.y),
        teamScale: Number((seatNode._teamNode._teamBaseScale || 1).toFixed(2)),
        countX: Math.round(seatNode._countLabel.node.x),
        countY: Math.round(seatNode._countLabel.node.y)
      };
    }
    var text = JSON.stringify(data, null, 2);
    var seatText = JSON.stringify(data[this.layoutDebug.seat], null, 2);
    cc.log('ShouBaYi layout debug:', text);
    if (cc.sys && cc.sys.localStorage) {
      cc.sys.localStorage.setItem('shoubayi_layout_debug', text);
    }
    this.copyLayoutJson(text);
    this.showLayoutJsonModal(this.layoutDebug.seat, seatText);
    this.showToast('布局JSON已复制');
  },
  copyLayoutJson: function copyLayoutJson(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
    if (typeof window !== 'undefined' && window.prompt) {
      window.prompt('复制布局 JSON', text);
    }
  },
  showLayoutJsonModal: function showLayoutJsonModal(seat, text) {
    if (this.layoutJsonLayer) this.layoutJsonLayer.destroy();
    var layer = this.makeNode('LayoutJsonLayer', 0, 0, 960, 640, this.root);
    layer.zIndex = 2000;
    this.layoutJsonLayer = layer;
    this.drawRect(layer, 960, 640, cc.color(0, 0, 0, 150));
    var panel = this.makeNode('LayoutJsonPanel', 0, 0, 560, 390, layer);
    this.drawRect(panel, 560, 390, cc.color(8, 36, 32, 242), 14, cc.color(255, 232, 150));
    this.makeLabel(seat + ' 布局 JSON', 0, 168, 22, cc.color(255, 241, 168), panel);
    this.makeLabel('完整 JSON 已尝试复制到剪贴板。', 0, 138, 15, cc.color(218, 235, 252), panel);
    var jsonLabel = this.makeLabel(text, -220, 12, 13, cc.color(255, 248, 220), panel);
    jsonLabel.node.setContentSize(440, 230);
    jsonLabel.node.anchorX = 0;
    jsonLabel.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
    jsonLabel.verticalAlign = cc.Label.VerticalAlign.TOP;
    jsonLabel.lineHeight = 17;
    this.makeButton('关闭', 0, -166, panel, this.closeLayoutJsonModal.bind(this), cc.color(90, 128, 110), 150, 'gray');
  },
  closeLayoutJsonModal: function closeLayoutJsonModal() {
    if (this.layoutJsonLayer) {
      this.layoutJsonLayer.destroy();
      this.layoutJsonLayer = null;
    }
  },
  drawAvatarMedallion: function drawAvatarMedallion(node, letter, baseColor, active) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    graphics.fillColor = cc.color(122, 72, 20, 160);
    graphics.circle(3, -5, 49);
    graphics.fill();
    graphics.fillColor = active ? cc.color(255, 226, 98) : cc.color(242, 183, 69);
    graphics.circle(0, 0, 48);
    graphics.fill();
    graphics.fillColor = cc.color(255, 244, 183);
    graphics.circle(0, 0, 40);
    graphics.fill();
    graphics.fillColor = baseColor || cc.color(255, 219, 117);
    graphics.circle(0, 0, 42);
    graphics.fill();
    graphics.fillColor = cc.color(255, 239, 176, 155);
    graphics.circle(-12, 12, 14);
    graphics.fill();
    if (!node._letterLabel) {
      node._letterLabel = this.makeLabel(letter, 0, 0, 26, cc.color(74, 45, 18), node);
      node._letterLabel.enableBold = true;
    }
    node._letterLabel.string = letter;
  },
  loadAvatarFrameSprite: function loadAvatarFrameSprite(node, resourcePath) {
    var frameNode = node._frameNode;
    if (!frameNode) {
      frameNode = this.makeNode('AvatarFrame', 0, 0, 124, 124, node);
      frameNode.zIndex = 8;
      node._frameNode = frameNode;
    }
    var sprite = frameNode.getComponent(cc.Sprite) || frameNode.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    var applyFrame = function applyFrame(spriteFrame) {
      sprite.spriteFrame = spriteFrame;
      frameNode.setContentSize(124, 124);
      if (node._letterLabel) node._letterLabel.node.zIndex = 10;
    };
    resourcePath = resourcePath || 'ui/Avatar frame';
    if (cc.resources && cc.resources.load) {
      cc.resources.load(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
        if (!error && spriteFrame) applyFrame(spriteFrame);
      });
      return;
    }
    cc.loader.loadRes(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
      if (!error && spriteFrame) applyFrame(spriteFrame);
    });
  },
  loadAvatarFillSprite: function loadAvatarFillSprite(node, resourcePath) {
    var sprite = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    var applyFrame = function applyFrame(spriteFrame) {
      var graphics = node.getComponent(cc.Graphics);
      if (graphics) graphics.clear();
      sprite.spriteFrame = spriteFrame;
      node.setContentSize(110, 110);
    };
    if (cc.resources && cc.resources.load) {
      cc.resources.load(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
        if (!error && spriteFrame) applyFrame(spriteFrame);
      });
      return;
    }
    cc.loader.loadRes(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
      if (!error && spriteFrame) applyFrame(spriteFrame);
    });
  },
  loadTeamSprite: function loadTeamSprite(node, resourcePath) {
    if (node._loadedTeamPath === resourcePath) return;
    node._loadedTeamPath = resourcePath;
    var sprite = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    var applyFrame = function applyFrame(spriteFrame) {
      var graphics = node.getComponent(cc.Graphics);
      if (graphics) graphics.clear();
      sprite.spriteFrame = spriteFrame;
      node.setContentSize(82, 24);
    };
    if (cc.resources && cc.resources.load) {
      cc.resources.load(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
        if (!error && spriteFrame) applyFrame(spriteFrame);
      });
      return;
    }
    cc.loader.loadRes(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
      if (!error && spriteFrame) applyFrame(spriteFrame);
    });
  },
  loadSimpleSprite: function loadSimpleSprite(node, resourcePath, width, height) {
    var sprite = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    this.simpleSpriteFrameCache = this.simpleSpriteFrameCache || {};
    var applyFrame = function applyFrame(spriteFrame) {
      var graphics = node.getComponent(cc.Graphics);
      if (graphics) graphics.clear();
      sprite.spriteFrame = spriteFrame;
      node.setContentSize(width, height);
    };
    if (this.simpleSpriteFrameCache[resourcePath]) {
      applyFrame(this.simpleSpriteFrameCache[resourcePath]);
      return;
    }
    var self = this;
    if (cc.resources && cc.resources.load) {
      cc.resources.load(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
        if (!error && spriteFrame) {
          self.simpleSpriteFrameCache[resourcePath] = spriteFrame;
          applyFrame(spriteFrame);
        }
      });
      return;
    }
    cc.loader.loadRes(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
      if (!error && spriteFrame) {
        self.simpleSpriteFrameCache[resourcePath] = spriteFrame;
        applyFrame(spriteFrame);
      }
    });
  },
  makeImageButton: function makeImageButton(name, resourcePath, x, y, maxWidth, maxHeight, parent, handler, fallbackText) {
    var node = this.makeNode(name, x, y, maxWidth, maxHeight, parent);
    this.drawGlossyRect(node, maxWidth, maxHeight, cc.color(239, 134, 21, 235), cc.color(255, 236, 133, 105), 20, cc.color(255, 232, 150));
    var fallbackLabel = this.makeLabel(fallbackText || '下一局', 0, 0, Math.max(18, Math.round(maxHeight * 0.42)), cc.color(255, 248, 220), node);
    fallbackLabel.node.zIndex = 2;
    var sprite = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    var applyFrame = function applyFrame(spriteFrame) {
      var graphics = node.getComponent(cc.Graphics);
      if (graphics) graphics.clear();
      if (fallbackLabel && fallbackLabel.node) fallbackLabel.node.destroy();
      sprite.spriteFrame = spriteFrame;
      var rect = spriteFrame.getRect ? spriteFrame.getRect() : null;
      var sourceWidth = rect ? rect.width : maxWidth;
      var sourceHeight = rect ? rect.height : maxHeight;
      var scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
      var width = Math.round(sourceWidth * scale);
      var height = Math.round(sourceHeight * scale);
      node.setContentSize(width, height);
    };
    var resourceName = resourcePath.split('/').pop();
    var paths = [resourcePath, resourcePath + '/spriteFrame', resourcePath + '/' + resourceName];
    var loaded = false;
    var tryLoad = function tryLoad(index) {
      if (loaded || index >= paths.length) return;
      var path = paths[index];
      var onLoaded = function onLoaded(error, spriteFrame, fallbackToLoader) {
        if (!error && spriteFrame) {
          loaded = true;
          applyFrame(spriteFrame);
          return;
        }
        if (fallbackToLoader && cc.loader && cc.loader.loadRes) {
          cc.loader.loadRes(path, cc.SpriteFrame, function (loaderError, loaderFrame) {
            onLoaded(loaderError, loaderFrame, false);
          });
          return;
        }
        tryLoad(index + 1);
      };
      if (cc.resources && cc.resources.load) {
        cc.resources.load(path, cc.SpriteFrame, function (error, spriteFrame) {
          onLoaded(error, spriteFrame, true);
        });
      } else {
        cc.loader.loadRes(path, cc.SpriteFrame, function (error, spriteFrame) {
          onLoaded(error, spriteFrame, false);
        });
      }
    };
    tryLoad(0);
    if (cc.Button) {
      var button = node.getComponent(cc.Button) || node.addComponent(cc.Button);
      button.transition = cc.Button.Transition.SCALE;
      button.duration = 0.08;
      button.zoomScale = 0.96;
    }
    node.on(cc.Node.EventType.TOUCH_END, handler, this);
    return node;
  },
  makeButton: function makeButton(text, x, y, parent, handler, color, width, style, hideLabel) {
    var buttonWidth = width || 150;
    var node = this.makeNode(text, x, y, buttonWidth, 48, parent);
    node._buttonWidth = buttonWidth;
    node._buttonColor = color;
    node._buttonStyle = style || 'default';
    node._buttonDisabled = false;
    var highlight = cc.color(255, 255, 255, 80);
    var stroke = cc.color(255, 231, 153, 170);
    if (node._buttonStyle === 'blue') {
      highlight = cc.color(116, 194, 255, 95);
      stroke = cc.color(164, 221, 255, 180);
    } else if (node._buttonStyle === 'brown') {
      highlight = cc.color(255, 181, 79, 95);
      stroke = cc.color(255, 210, 133, 160);
    } else if (node._buttonStyle === 'gray') {
      highlight = cc.color(229, 237, 214, 90);
      stroke = cc.color(236, 242, 211, 135);
    }
    this.drawGlossyRect(node, buttonWidth, 48, color, highlight, 22, stroke);
    this.loadButtonSprite(node);
    if (!hideLabel) {
      var label = this.makeLabel(text, 0, 1, 18, cc.color(255, 248, 220), node);
      label.enableBold = true;
      node._buttonLabel = label;
    }
    node.on(cc.Node.EventType.TOUCH_END, function () {
      if (node._buttonDisabled) return;
      handler.call(this);
    }, this);
    return node;
  },
  setButtonEnabled: function setButtonEnabled(node, enabled) {
    if (!node) return;
    node._buttonDisabled = !enabled;
    node.opacity = enabled ? 255 : 105;
    var button = node.getComponent(cc.Button);
    if (button) button.interactable = !!enabled;
  },
  loadButtonSprite: function loadButtonSprite(node) {
    var map = {
      orange: 'ui/button-orange',
      blue: 'ui/button-blue',
      brown: 'ui/button-brown',
      gray: 'ui/button-graygreen',
      "default": null
    };
    var resourcePath = map[node._buttonStyle] || null;
    if (!resourcePath) return;
    var sprite = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    var applyFrame = function applyFrame(spriteFrame) {
      var graphics = node.getComponent(cc.Graphics);
      if (graphics) graphics.clear();
      sprite.spriteFrame = spriteFrame;
      node.setContentSize(node._buttonWidth, 48);
    };
    if (cc.resources && cc.resources.load) {
      cc.resources.load(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
        if (!error && spriteFrame) applyFrame(spriteFrame);
      });
      return;
    }
    cc.loader.loadRes(resourcePath, cc.SpriteFrame, function (error, spriteFrame) {
      if (!error && spriteFrame) applyFrame(spriteFrame);
    });
  },
  loadTableBackground: function loadTableBackground() {
    var bg = this.makeNode('GeneratedTableBackground', 0, 0, 960, 640, this.root);
    bg.zIndex = -10;
    var sprite = bg.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    bg.setContentSize(960, 640);
    var applyFrame = function applyFrame(spriteFrame) {
      sprite.spriteFrame = spriteFrame;
      bg.opacity = 255;
      if (this.fallbackBackground) this.fallbackBackground.active = false;
    };
    applyFrame = applyFrame.bind(this);
    if (cc.resources && cc.resources.load) {
      cc.resources.load('table-bg-v1', cc.SpriteFrame, function (error, spriteFrame) {
        if (!error && spriteFrame) applyFrame(spriteFrame);
      });
      return;
    }
    cc.loader.loadRes('table-bg-v1', cc.SpriteFrame, function (error, spriteFrame) {
      if (!error && spriteFrame) applyFrame(spriteFrame);
    });
  },
  showStarterModal: function showStarterModal() {
    var children = this.modalLayer.children.slice();
    for (var i = 0; i < children.length; i += 1) children[i].destroy();
    this.modalLayer.active = true;
    var shade = this.makeNode('ModalShade', 0, 0, 960, 640, this.modalLayer);
    this.drawRect(shade, 960, 640, cc.color(0, 0, 0, 150), 0);
    var panel = this.makeNode('StarterPanel', 0, 26, 480, 320, this.modalLayer);
    this.drawRect(panel, 480, 320, cc.color(252, 235, 203, 248), 22, cc.color(255, 219, 102));
    var titleRibbon = this.makeNode('StarterRibbon', 0, 130, 320, 56, panel);
    this.drawGlossyRect(titleRibbon, 320, 56, cc.color(172, 39, 28, 250), cc.color(255, 96, 45, 135), 18, cc.color(255, 214, 105));
    this.makeLabel('随机先手', 0, 130, 30, cc.color(255, 242, 179), panel);
    var inner = this.makeNode('StarterInner', 0, -8, 406, 170, panel);
    this.drawRect(inner, 406, 170, cc.color(255, 244, 222, 210), 14, cc.color(221, 172, 90));
    var cardHolder = this.makeNode('StarterCardHolder', -104, 0, 96, 126, inner);
    this.makeCardNode(this.state.starterCard, 0, 0, 74, 104, {
      parent: cardHolder,
      selectable: false,
      selectedOffset: 0,
      suitScale: 1.1
    });
    var divider = this.makeNode('StarterDivider', -20, 0, 2, 118, inner);
    this.drawRect(divider, 2, 118, cc.color(221, 172, 90, 95), 1);
    this.makeLabel(this.playerName(this.state.starterSeat), 112, 20, 26, cc.color(44, 98, 172), inner);
    this.makeLabel('首出', 112, -22, 24, cc.color(104, 54, 24), inner);
    this.makeImageButton('StarterStartButton', 'ui/star', 0, -128, 150, 50, panel, this.closeStarterModal.bind(this), '开始');
  },
  closeStarterModal: function closeStarterModal() {
    this.modalLayer.active = false;
    if (this.state && this.state.phase === 'PLAYING' && this.state.current !== 'A') {
      this.scheduleOnce(this.botToMe.bind(this), 0.25);
    }
  },
  clearModalLayer: function clearModalLayer() {
    var children = this.modalLayer.children.slice();
    for (var i = 0; i < children.length; i += 1) children[i].destroy();
  },
  showRoundEndModal: function showRoundEndModal() {
    if (!this.state || !this.state.lastResult) return;
    this.clearModalLayer();
    this.modalLayer.active = true;
    var result = this.state.lastResult;
    var winnerTeamName = result.winnerTeam === 'AC' ? 'BLUE' : 'RED';
    var winnerColor = result.winnerTeam === 'AC' ? cc.color(33, 115, 220, 245) : cc.color(191, 41, 28, 245);
    var winnerHighlight = result.winnerTeam === 'AC' ? cc.color(92, 178, 255, 115) : cc.color(255, 94, 48, 115);
    var firstName = this.playerName(result.firstFinishedSeat);
    var unfinishedSeats = [];
    for (var u = 0; u < this.seats.length; u += 1) {
      if (result.finishedOrder.indexOf(this.seats[u]) < 0) unfinishedSeats.push(this.seats[u]);
    }
    var lastName = unfinishedSeats.length ? unfinishedSeats.map(function (seat) {
      return this.playerName(seat);
    }, this).join('、') : this.playerName(result.finishedOrder[result.finishedOrder.length - 1]);
    var shade = this.makeNode('ModalShade', 0, 0, 960, 640, this.modalLayer);
    this.drawRect(shade, 960, 640, cc.color(0, 0, 0, 150), 0);
    var panel = this.makeNode('RoundEndPanel', 0, 22, 560, 360, this.modalLayer);
    this.drawRect(panel, 560, 360, cc.color(252, 235, 203, 248), 22, cc.color(255, 219, 102));
    var inner = this.makeNode('RoundEndInner', 0, -2, 488, 246, panel);
    this.drawRect(inner, 488, 246, cc.color(255, 244, 222, 210), 14, cc.color(221, 172, 90));
    var titleRibbon = this.makeNode('RoundEndRibbon', 0, 140, 380, 58, panel);
    this.drawGlossyRect(titleRibbon, 380, 58, cc.color(172, 39, 28, 250), cc.color(255, 96, 45, 135), 20, cc.color(255, 214, 105));
    this.makeLabel('本局结算', 0, 140, 32, cc.color(255, 242, 179), panel);
    var badge = this.makeNode('WinnerBadge', -158, 40, 110, 116, inner);
    this.drawGlossyRect(badge, 110, 116, winnerColor, winnerHighlight, 18, cc.color(255, 205, 78));
    this.makeLabel(winnerTeamName, 0, 20, 26, cc.color(255, 238, 169), badge);
    this.makeLabel('获胜', 0, -28, 23, cc.color(255, 242, 179), badge);
    var divider = this.makeNode('RoundEndDivider', -32, 46, 2, 98, inner);
    this.drawRect(divider, 2, 98, cc.color(221, 172, 90, 95), 1);
    this.makeLabel('升 ' + result.levelUp + ' 级', 98, 66, 28, cc.color(104, 54, 24), inner);
    this.makeLabel(this.state.levelRank + '  ->  ' + result.nextLevelRank, 98, 24, 30, cc.color(183, 42, 31), inner);
    var infoBar = this.makeNode('RoundEndInfoBar', 0, -72, 430, 70, inner);
    this.drawRect(infoBar, 430, 70, cc.color(231, 204, 164, 150), 18);
    this.makeLabel('第一名：' + firstName, 0, 17, 20, cc.color(104, 54, 24), infoBar);
    this.makeLabel((unfinishedSeats.length > 1 ? '未出完：' : '最后：') + lastName, 0, -17, 20, cc.color(44, 98, 172), infoBar);
    this.makeImageButton('NextRoundImageButton', 'ui/next', 0, -154, 142, 46, panel, this.onNextRound.bind(this));
  },
  roundOrderText: function roundOrderText(result) {
    var lines = ['名次'];
    for (var i = 0; i < this.seats.length; i += 1) {
      var seat = this.seats[i];
      var order = result.finishedOrder.indexOf(seat);
      var rank = order >= 0 ? '第 ' + (order + 1) + ' 名' : '未出完';
      lines.push(rank + '  ' + this.playerName(seat));
    }
    return lines.join('\n');
  },
  nextStarterHint: function nextStarterHint(result) {
    if (result.levelUp === 0) {
      return '下一局先手\n打平，由第一名\n' + this.playerName(result.firstFinishedSeat) + ' 先出';
    }
    if (result.levelUp === 1 && result.tributeLoserSeats.length === 1) {
      return '下一局先手\n单贡后由进贡方\n' + this.playerName(result.tributeLoserSeats[0]) + ' 先出';
    }
    if (result.levelUp === 2) {
      return '下一局先手\n双贡后由输方随机一人先出\n抗贡则第一名先出';
    }
    return '下一局先手\n进入下一局后按进贡结果确定';
  },
  shouldShowTributeModal: function shouldShowTributeModal(tribute) {
    return tribute && tribute.modeKey !== 'NONE';
  },
  showTributeModal: function showTributeModal(tribute) {
    var children = this.modalLayer.children.slice();
    for (var i = 0; i < children.length; i += 1) children[i].destroy();
    this.modalLayer.active = true;
    var shade = this.makeNode('ModalShade', 0, 0, 960, 640, this.modalLayer);
    this.drawRect(shade, 960, 640, cc.color(0, 0, 0, 150), 0);
    var panel = this.makeNode('TributePanel', 0, 26, 560, 340, this.modalLayer);
    this.drawRect(panel, 560, 340, cc.color(252, 235, 203, 248), 22, cc.color(255, 219, 102));
    var titleRibbon = this.makeNode('TributeRibbon', 0, 132, 380, 58, panel);
    this.drawGlossyRect(titleRibbon, 380, 58, cc.color(172, 39, 28, 250), cc.color(255, 96, 45, 135), 20, cc.color(255, 214, 105));
    var inner = this.makeNode('TributeInner', 0, -8, 488, 220, panel);
    this.drawRect(inner, 488, 220, cc.color(255, 244, 222, 210), 14, cc.color(221, 172, 90));
    var title = '进贡确认';
    var tip = '确认后进入下一步';
    if (tribute.modeKey === 'RESIST') {
      title = '抗贡';
      tip = '本局免进贡';
    } else if (tribute.modeKey === 'REVERSE') {
      title = '反贡';
      tip = '触发反贡';
    } else if (tribute.cards.length === 2) {
      title = '双贡确认';
      tip = '先展示贡牌';
    } else if (tribute.cards.length === 1) {
      title = '单贡确认';
      tip = '确认后进入返牌';
    }
    this.makeLabel(title, 0, 132, 32, cc.color(255, 242, 179), panel);
    this.makeLabel(tip, 0, 84, 17, cc.color(104, 54, 24), panel);
    if (tribute.cards.length) {
      var gap = tribute.cards.length === 1 ? 0 : 88;
      var startX = -152 - gap * (tribute.cards.length - 1) / 2;
      for (var c = 0; c < tribute.cards.length; c += 1) {
        var tributeCard = tribute.cards[c];
        var cardHolder = this.makeNode('TributeCardHolder', startX + c * gap, 4, 86, 116, inner);
        this.makeCardNode(tributeCard.card, 0, 8, 70, 98, {
          parent: cardHolder,
          selectable: false,
          selectedOffset: 0,
          suitScale: 1.1
        });
        this.makeLabel(this.playerName(tributeCard.seat), startX + c * gap, -68, 15, cc.color(104, 54, 24), inner);
      }
    } else {
      var loserText = tribute.contributorSeats && tribute.contributorSeats.length ? tribute.contributorSeats.join('、') : this.state.lastResult.loserTeam;
      var resistText = loserText + ' 触发抗贡\n本局免进贡';
      var resistLabel = this.makeLabel(resistText, -138, 0, 22, cc.color(104, 54, 24), inner);
      resistLabel.lineHeight = 32;
    }
    var divider = this.makeNode('TributeDivider', -30, 0, 2, 146, inner);
    this.drawRect(divider, 2, 146, cc.color(221, 172, 90, 95), 1);
    var statusTitle = '';
    var statusMain = '';
    var statusSub = '';
    if (tribute.cards.length === 1) {
      var receiverSeat = tribute.receiverSeats && tribute.receiverSeats[0] ? tribute.receiverSeats[0] : this.state.lastResult.firstFinishedSeat;
      statusTitle = this.playerName(tribute.cards[0].seat);
      statusMain = '进贡给';
      statusSub = this.playerName(receiverSeat);
    } else if (tribute.cards.length > 1) {
      statusTitle = '待赢家选择';
      statusMain = '贡牌池';
      statusSub = '确认后进入选贡牌';
    } else {
      statusTitle = '无需进贡';
      statusMain = '由第一名';
      statusSub = this.playerName(this.state.lastResult.firstFinishedSeat) + ' 首出';
    }
    this.makeLabel(statusTitle, 126, 34, 22, cc.color(44, 98, 172), inner);
    this.makeLabel(statusMain, 126, -4, 20, cc.color(104, 54, 24), inner);
    this.makeLabel(statusSub, 126, -42, 18, cc.color(183, 42, 31), inner);
    this.makeImageButton('TributeConfirmButton', 'ui/star', 0, -136, 150, 50, panel, this.closeTributeModal.bind(this), '确认');
  },
  closeTributeModal: function closeTributeModal() {
    this.modalLayer.active = false;
    this.pushLog('进贡提示已确认。');
    if (this.state && this.state.tribute && this.state.tribute.modeKey === 'NORMAL' && this.state.tribute.assignments && this.state.tribute.assignments.length) {
      this.beginTributeReturnFlow();
      return;
    }
    if (this.state) this.state.tributeResolved = true;
    if (this.state && this.state.phase === 'PLAYING' && this.state.current !== 'A') {
      this.scheduleOnce(this.botToMe.bind(this), 0.25);
    }
  },
  showReturnModal: function showReturnModal() {
    var returns = [];
    var pending = this.state.pendingReturns || [];
    for (var i = 0; i < pending.length; i += 1) {
      if (pending[i].returnCard) returns.push(pending[i]);
    }
    if (!returns.length) {
      this.finishTributeReturnFlow();
      return;
    }
    var children = this.modalLayer.children.slice();
    for (var c = 0; c < children.length; c += 1) children[c].destroy();
    this.modalLayer.active = true;
    var shade = this.makeNode('ModalShade', 0, 0, 960, 640, this.modalLayer);
    this.drawRect(shade, 960, 640, cc.color(0, 0, 0, 150), 0);
    var panel = this.makeNode('ReturnPanel', 0, 26, 560, 340, this.modalLayer);
    this.drawRect(panel, 560, 340, cc.color(252, 235, 203, 248), 22, cc.color(255, 219, 102));
    var titleRibbon = this.makeNode('ReturnRibbon', 0, 132, 380, 58, panel);
    this.drawGlossyRect(titleRibbon, 380, 58, cc.color(172, 39, 28, 250), cc.color(255, 96, 45, 135), 20, cc.color(255, 214, 105));
    this.makeLabel('返牌确认', 0, 132, 32, cc.color(255, 242, 179), panel);
    this.makeLabel('确认后由进贡方先出', 0, 84, 17, cc.color(104, 54, 24), panel);
    var inner = this.makeNode('ReturnInner', 0, -8, 488, 220, panel);
    this.drawRect(inner, 488, 220, cc.color(255, 244, 222, 210), 14, cc.color(221, 172, 90));
    var gap = returns.length === 1 ? 0 : 88;
    var startX = -152 - gap * (returns.length - 1) / 2;
    for (var r = 0; r < returns.length; r += 1) {
      var item = returns[r];
      var holder = this.makeNode('ReturnCardHolder', startX + r * gap, 4, 86, 116, inner);
      this.makeCardNode(item.returnCard, 0, 8, 70, 98, {
        parent: holder,
        selectable: false,
        selectedOffset: 0,
        suitScale: 1.1
      });
      this.makeLabel(this.playerName(item.receiveSeat), startX + r * gap, -68, 15, cc.color(104, 54, 24), inner);
    }
    var divider = this.makeNode('ReturnDivider', -30, 0, 2, 146, inner);
    this.drawRect(divider, 2, 146, cc.color(221, 172, 90, 95), 1);
    var firstReturn = returns[0];
    var statusTitle = returns.length > 1 ? '返牌完成' : this.playerName(firstReturn.receiveSeat);
    var statusMain = returns.length > 1 ? '双方已返牌' : '返给 ' + this.playerName(firstReturn.fromSeat);
    var statusSub = '下一手：' + this.playerName(this.state.afterTributeStarterSeat || this.state.current);
    this.makeLabel(statusTitle, 126, 34, 22, cc.color(44, 98, 172), inner);
    this.makeLabel(statusMain, 126, -4, 20, cc.color(104, 54, 24), inner);
    this.makeLabel(statusSub, 126, -42, 18, cc.color(183, 42, 31), inner);
    this.makeImageButton('ReturnConfirmButton', 'ui/star', 0, -136, 150, 50, panel, this.closeReturnModal.bind(this), '确认开始');
  },
  closeReturnModal: function closeReturnModal() {
    this.modalLayer.active = false;
    this.finishTributeReturnFlow();
  },
  beginTributeReturnFlow: function beginTributeReturnFlow() {
    var assignments = this.state.tribute.assignments;
    this.state.afterTributeStarterSeat = this.state.tribute.nextStarterSeat || this.state.current;
    this.state.pendingReturns = [];
    for (var i = 0; i < assignments.length; i += 1) {
      var item = assignments[i];
      var moved = this.moveCardBetweenSeats(item.fromSeat, item.receiveSeat, item.card.id);
      if (moved) {
        this.state.pendingReturns.push({
          fromSeat: item.fromSeat,
          receiveSeat: item.receiveSeat,
          tributeCard: item.card,
          returned: false
        });
        this.pushLog(item.fromSeat + ' 进贡 ' + this.cardName(item.card) + ' 给 ' + item.receiveSeat);
      }
    }
    this.sortAllHands();
    this.autoReturnTributeCards();
    if (this.needsPlayerReturn()) {
      this.state.phase = 'RETURNING_TRIBUTE';
      this.state.current = 'A';
      this.selectedIds = {};
      this.showToast('请选择一张非癞子返牌');
      this.pushLog('你拿到了贡牌，请选 1 张非癞子返给进贡方。');
      this.render();
      return;
    }
    this.showReturnModal();
  },
  autoReturnTributeCards: function autoReturnTributeCards() {
    var pending = this.state.pendingReturns || [];
    for (var i = 0; i < pending.length; i += 1) {
      var item = pending[i];
      if (item.returned || item.receiveSeat === 'A') continue;
      var card = this.chooseAutoReturnCard(item.receiveSeat, item.tributeCard.id);
      if (!card) continue;
      this.moveCardBetweenSeats(item.receiveSeat, item.fromSeat, card.id);
      item.returned = true;
      item.returnCard = card;
      this.pushLog(item.receiveSeat + ' 返牌 ' + this.cardName(card) + ' 给 ' + item.fromSeat);
    }
    this.sortAllHands();
  },
  needsPlayerReturn: function needsPlayerReturn() {
    var pending = this.state.pendingReturns || [];
    for (var i = 0; i < pending.length; i += 1) {
      if (!pending[i].returned && pending[i].receiveSeat === 'A') return true;
    }
    return false;
  },
  returnSelectedTributeCard: function returnSelectedTributeCard() {
    var pending = this.state.pendingReturns || [];
    var target = null;
    for (var i = 0; i < pending.length; i += 1) {
      if (!pending[i].returned && pending[i].receiveSeat === 'A') {
        target = pending[i];
        break;
      }
    }
    if (!target) {
      this.finishTributeReturnFlow();
      return;
    }
    var selected = this.selectedCards();
    if (selected.length !== 1) {
      this.showToast('返牌只能选 1 张');
      return;
    }
    var card = selected[0];
    if (card.rank === 'LZ') {
      this.showToast('癞子不能返');
      return;
    }
    if (target.tributeCard && card.id === target.tributeCard.id) {
      this.showToast('不能把贡牌原样返还');
      return;
    }
    this.moveCardBetweenSeats('A', target.fromSeat, card.id);
    target.returned = true;
    target.returnCard = card;
    this.selectedIds = {};
    this.sortAllHands();
    this.pushLog('A 返牌 ' + this.cardName(card) + ' 给 ' + target.fromSeat);
    if (this.needsPlayerReturn()) {
      this.showToast('还需要再返 1 张');
      this.render();
      return;
    }
    this.showReturnModal();
  },
  finishTributeReturnFlow: function finishTributeReturnFlow() {
    this.state.phase = 'PLAYING';
    this.state.tributeResolved = true;
    if (this.state.afterTributeStarterSeat) {
      this.state.current = this.state.afterTributeStarterSeat;
      this.state.starterSeat = this.state.afterTributeStarterSeat;
    }
    this.selectedIds = {};
    this.pushLog('进贡和返牌完成，开始出牌。');
    this.render();
    if (this.state.current !== 'A') {
      this.scheduleOnce(this.botToMe.bind(this), 0.3);
    }
  },
  chooseAutoReturnCard: function chooseAutoReturnCard(seat, excludeCardId) {
    var hand = this.state.hands[seat];
    for (var i = 0; i < hand.length; i += 1) {
      if (hand[i].rank !== 'LZ' && hand[i].id !== excludeCardId) return hand[i];
    }
    return null;
  },
  moveCardBetweenSeats: function moveCardBetweenSeats(fromSeat, toSeat, cardId) {
    var hand = this.state.hands[fromSeat];
    for (var i = 0; i < hand.length; i += 1) {
      if (hand[i].id === cardId) {
        var card = hand.splice(i, 1)[0];
        this.state.hands[toSeat].push(card);
        return card;
      }
    }
    return null;
  },
  sortAllHands: function sortAllHands() {
    for (var i = 0; i < this.seats.length; i += 1) {
      this.sortHand(this.state.hands[this.seats[i]]);
    }
  },
  showToast: function showToast(text) {
    this.toastLabel.string = text;
    this.toastNode.active = true;
    if (this.toastTimer) this.unschedule(this.toastTimer);
    this.toastTimer = this.hideToast.bind(this);
    this.scheduleOnce(this.toastTimer, 1.15);
  },
  hideToast: function hideToast() {
    if (this.toastNode) this.toastNode.active = false;
  },
  makeNode: function makeNode(name, x, y, width, height, parent) {
    var node = new cc.Node(name);
    node.parent = parent;
    node.setPosition(x, y);
    node.setContentSize(width, height);
    return node;
  },
  makeLabel: function makeLabel(text, x, y, fontSize, color, parent) {
    var node = this.makeNode('Label', x, y, 900, fontSize + 10, parent);
    var label = node.addComponent(cc.Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
    label.verticalAlign = cc.Label.VerticalAlign.CENTER;
    node.color = color;
    return label;
  },
  drawRect: function drawRect(node, width, height, color, radius, strokeColor) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    graphics.fillColor = color;
    if (strokeColor) {
      graphics.strokeColor = strokeColor;
      graphics.lineWidth = 2;
    }
    if (radius && graphics.roundRect) {
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    } else {
      graphics.rect(-width / 2, -height / 2, width, height);
    }
    graphics.fill();
    if (strokeColor) graphics.stroke();
  },
  drawTopStatusBar: function drawTopStatusBar(node, width, height) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    var radius = 14;
    graphics.fillColor = cc.color(7, 71, 178, 238);
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    } else {
      graphics.rect(-width / 2, -height / 2, width, height);
    }
    graphics.fill();
    graphics.fillColor = cc.color(74, 161, 255, 78);
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 7, 2, width - 14, height / 2 - 5, Math.max(4, radius - 5));
    } else {
      graphics.rect(-width / 2 + 7, 2, width - 14, height / 2 - 5);
    }
    graphics.fill();
    graphics.strokeColor = cc.color(86, 166, 255, 190);
    graphics.lineWidth = 1;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius);
    } else {
      graphics.rect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
    }
    graphics.stroke();
    graphics.strokeColor = cc.color(158, 211, 255, 58);
    var dividers = [-204, -72, 52, 182];
    for (var i = 0; i < dividers.length; i += 1) {
      graphics.moveTo(dividers[i], -10);
      graphics.lineTo(dividers[i], 10);
      graphics.stroke();
    }
  },
  drawTopTeamPill: function drawTopTeamPill(node, width, height, style) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    var isRed = style === 'red';
    var base = isRed ? cc.color(158, 54, 84, 230) : cc.color(41, 118, 218, 230);
    var shine = isRed ? cc.color(255, 142, 154, 68) : cc.color(139, 204, 255, 75);
    var stroke = isRed ? cc.color(255, 143, 154, 120) : cc.color(146, 208, 255, 130);
    graphics.fillColor = base;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2, -height / 2, width, height, height / 2);
    } else {
      graphics.rect(-width / 2, -height / 2, width, height);
    }
    graphics.fill();
    graphics.fillColor = shine;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 5, 1, width - 10, height / 2 - 4, Math.max(4, height / 2 - 4));
    } else {
      graphics.rect(-width / 2 + 5, 1, width - 10, height / 2 - 4);
    }
    graphics.fill();
    graphics.strokeColor = stroke;
    graphics.lineWidth = 1;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, height / 2 - 1);
    } else {
      graphics.rect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
    }
    graphics.stroke();
  },
  drawGlossyRect: function drawGlossyRect(node, width, height, baseColor, highlightColor, radius, strokeColor) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    graphics.fillColor = baseColor;
    if (radius && graphics.roundRect) {
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    } else {
      graphics.rect(-width / 2, -height / 2, width, height);
    }
    graphics.fill();
    graphics.fillColor = highlightColor;
    if (radius && graphics.roundRect) {
      graphics.roundRect(-width / 2 + 5, 1, width - 10, height / 2 - 5, Math.max(4, radius - 4));
    } else {
      graphics.rect(-width / 2 + 5, 1, width - 10, height / 2 - 5);
    }
    graphics.fill();
    graphics.fillColor = cc.color(0, 0, 0, 34);
    if (radius && graphics.roundRect) {
      graphics.roundRect(-width / 2 + 8, -height / 2 + 4, width - 16, 8, 4);
    } else {
      graphics.rect(-width / 2 + 8, -height / 2 + 4, width - 16, 8);
    }
    graphics.fill();
    if (strokeColor) {
      graphics.strokeColor = strokeColor;
      graphics.lineWidth = 2;
      if (radius && graphics.roundRect) {
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
      } else {
        graphics.rect(-width / 2, -height / 2, width, height);
      }
      graphics.stroke();
    }
  },
  drawCircle: function drawCircle(node, radius, color, strokeColor, lineWidth) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    graphics.fillColor = color;
    graphics.circle(0, 0, radius);
    graphics.fill();
    if (strokeColor) {
      graphics.strokeColor = strokeColor;
      graphics.lineWidth = lineWidth || 2;
      graphics.circle(0, 0, radius);
      graphics.stroke();
    }
  },
  drawScenicBackground: function drawScenicBackground(node) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    graphics.fillColor = cc.color(52, 151, 236);
    graphics.rect(-480, -320, 960, 640);
    graphics.fill();
    graphics.fillColor = cc.color(105, 192, 249);
    graphics.rect(-480, 40, 960, 180);
    graphics.fill();
    this.drawCloud(graphics, -310, 185, 1.0);
    this.drawCloud(graphics, 260, 198, 0.9);
    this.drawCloud(graphics, 40, 158, 0.7);
    graphics.fillColor = cc.color(101, 151, 171);
    graphics.moveTo(-480, 36);
    graphics.lineTo(-360, 116);
    graphics.lineTo(-230, 42);
    graphics.lineTo(-95, 132);
    graphics.lineTo(40, 40);
    graphics.lineTo(190, 126);
    graphics.lineTo(335, 36);
    graphics.lineTo(480, 112);
    graphics.lineTo(480, -48);
    graphics.lineTo(-480, -48);
    graphics.close();
    graphics.fill();
    graphics.fillColor = cc.color(55, 124, 83);
    graphics.rect(-480, -320, 960, 210);
    graphics.fill();
    graphics.fillColor = cc.color(86, 61, 45);
    graphics.rect(-480, -320, 960, 84);
    graphics.fill();
  },
  drawCloud: function drawCloud(graphics, x, y, scale) {
    graphics.fillColor = cc.color(240, 249, 255);
    graphics.circle(x - 32 * scale, y, 18 * scale);
    graphics.circle(x - 8 * scale, y + 12 * scale, 25 * scale);
    graphics.circle(x + 24 * scale, y + 4 * scale, 20 * scale);
    graphics.circle(x + 48 * scale, y, 15 * scale);
    graphics.fill();
  },
  drawTableSurface: function drawTableSurface(node, width, height) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    graphics.fillColor = cc.color(94, 55, 21);
    this.ellipsePath(graphics, width, height);
    graphics.fill();
    graphics.fillColor = cc.color(226, 164, 55);
    this.ellipsePath(graphics, width - 22, height - 18);
    graphics.fill();
    graphics.fillColor = cc.color(41, 134, 78);
    this.ellipsePath(graphics, width - 58, height - 48);
    graphics.fill();
    graphics.strokeColor = cc.color(255, 220, 102);
    graphics.lineWidth = 3;
    this.ellipsePath(graphics, width - 38, height - 32);
    graphics.stroke();
  },
  drawCenterGuide: function drawCenterGuide(node) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    graphics.clear();
    graphics.strokeColor = cc.color(141, 214, 151);
    graphics.lineWidth = 2;
    graphics.moveTo(-210, -6);
    graphics.lineTo(-96, -6);
    graphics.moveTo(96, -6);
    graphics.lineTo(210, -6);
    graphics.stroke();
    graphics.fillColor = cc.color(141, 214, 151);
    graphics.moveTo(-92, -6);
    graphics.lineTo(-82, 0);
    graphics.lineTo(-72, -6);
    graphics.lineTo(-82, -12);
    graphics.close();
    graphics.fill();
    graphics.moveTo(92, -6);
    graphics.lineTo(82, 0);
    graphics.lineTo(72, -6);
    graphics.lineTo(82, -12);
    graphics.close();
    graphics.fill();
  },
  ellipsePath: function ellipsePath(graphics, width, height) {
    var steps = 72;
    var rx = width / 2;
    var ry = height / 2;
    for (var i = 0; i <= steps; i += 1) {
      var angle = Math.PI * 2 * i / steps;
      var x = Math.cos(angle) * rx;
      var y = Math.sin(angle) * ry;
      if (i === 0) graphics.moveTo(x, y);else graphics.lineTo(x, y);
    }
    graphics.close();
  },
  startGame: function startGame() {
    this.startRound({
      roundNumber: 1,
      levelRank: '3',
      pickStarter: true,
      log: ['新局开始。你是 A，当前打 3。']
    });
  },
  startRound: function startRound(options) {
    var deck = this.shuffle(this.makeDeck());
    this.state = {
      phase: 'PLAYING',
      current: options.startSeat || 'A',
      levelRank: options.levelRank,
      roundNumber: options.roundNumber,
      starterCard: null,
      starterSeat: options.startSeat || 'A',
      lastPlay: null,
      tablePlays: {},
      passTips: {},
      passes: [],
      trickResolving: false,
      finished: [],
      lastResult: options.lastResult || null,
      tribute: options.tribute || null,
      tributeResolved: false,
      pendingReturns: [],
      hands: {
        A: [],
        B: [],
        C: [],
        D: []
      }
    };
    this.logLines = options.log.slice();
    this.lastTurnNoticeSeat = null;
    for (var i = 0; i < deck.length; i += 1) {
      this.state.hands[this.seats[i % 4]].push(deck[i]);
    }
    for (var s = 0; s < this.seats.length; s += 1) {
      this.sortHand(this.state.hands[this.seats[s]]);
    }
    this.isDealing = true;
    this.dealVisibleHandCount = 0;
    if (options.pickStarter) {
      this.pickStarterCard();
    }
    if (this.state.tribute) {
      this.pushLog(this.state.tribute.summary);
    }
    this.selectedIds = {};
    this.render();
    this.playDealAnimation(function () {
      if (options.pickStarter && this.state && this.state.starterCard) {
        this.showStarterModal();
      }
    }.bind(this));
  },
  pickStarterCard: function pickStarterCard() {
    var allCards = [];
    for (var s = 0; s < this.seats.length; s += 1) {
      var seat = this.seats[s];
      for (var i = 0; i < this.state.hands[seat].length; i += 1) {
        allCards.push({
          seat: seat,
          card: this.state.hands[seat][i]
        });
      }
    }
    var picked = allCards[Math.floor(Math.random() * allCards.length)];
    this.state.starterCard = picked.card;
    this.state.starterSeat = picked.seat;
    this.state.current = picked.seat;
    this.pushLog('系统明牌：' + this.cardName(picked.card) + '，在 ' + this.playerName(picked.seat) + ' 手里，' + picked.seat + ' 首出。');
  },
  runAfterDeal: function runAfterDeal(callback) {
    if (!callback) return;
    if (this.isDealing) {
      this.afterDealCallbacks.push(callback);
      return;
    }
    callback();
  },
  playDealAnimation: function playDealAnimation(callback) {
    if (callback) this.runAfterDeal(callback);
    if (!this.root || !cc || !cc.sequence) {
      this.finishDealAnimation();
      return;
    }
    if (this.dealAnimationLayer) {
      this.dealAnimationLayer.destroy();
      this.dealAnimationLayer = null;
    }
    var layer = this.makeNode('DealAnimationLayer', 0, 0, 960, 640, this.root);
    layer.zIndex = 880;
    this.dealAnimationLayer = layer;
    var targets = {
      A: cc.v2(40, -236),
      B: cc.v2(350, 82),
      C: cc.v2(0, 172),
      D: cc.v2(-350, 82)
    };
    var seatOrder = ['A', 'B', 'C', 'D'];
    this.dealVisibleHandCount = 0;
    this.renderHand();
    var total = 220;
    var delayStep = 0.008;
    var playerDealIndex = 0;
    var backDealCounts = {
      B: 0,
      C: 0,
      D: 0
    };
    for (var i = 0; i < total; i += 1) {
      var seat = seatOrder[i % seatOrder.length];
      if (seat === 'A') {
        var playerCard = this.state.hands.A[playerDealIndex];
        var playerIndex = playerDealIndex;
        playerDealIndex += 1;
        var playerTarget = this.handCardPosition(playerIndex, playerIndex + 1);
        var playerNode = this.makeCardNode(playerCard, 0, 18, 62, 84, {
          parent: layer,
          selectable: false,
          selectedOffset: 0
        });
        playerNode.opacity = 0;
        playerNode.scale = 0.72;
        playerNode.zIndex = i;
        playerNode.runAction(cc.sequence(cc.delayTime(i * delayStep), cc.spawn(cc.fadeIn(0.05), cc.moveTo(0.24, cc.v2(playerTarget.x, playerTarget.y)).easing(cc.easeCubicActionOut()), cc.scaleTo(0.24, 1), cc.rotateTo(0.24, 0)), cc.callFunc(function (node) {
          if (node && node.destroy) node.destroy();
          if (!this.isDealing || !this.state || !this.state.hands || !this.state.hands.A) return;
          this.dealVisibleHandCount = Math.min(this.state.hands.A.length, this.dealVisibleHandCount + 1);
          this.renderHand();
        }, this, playerNode)));
        continue;
      }
      backDealCounts[seat] += 1;
      if (backDealCounts[seat] % 4 !== 1) continue;
      var node = this.makeDealCardBack(0, 18, layer);
      var spread = Math.floor(i / 4) % 9 - 4;
      var target = targets[seat];
      var targetX = target.x + spread * (seat === 'A' || seat === 'C' ? 16 : 5);
      var targetY = target.y + spread * (seat === 'B' || seat === 'D' ? 9 : 2);
      node.opacity = 0;
      node.scale = 0.45;
      node.rotation = -8 + i % 5 * 4;
      node.zIndex = i;
      node.runAction(cc.sequence(cc.delayTime(i * delayStep), cc.spawn(cc.fadeIn(0.04), cc.moveTo(0.24, cc.v2(targetX, targetY)).easing(cc.easeCubicActionOut()), cc.scaleTo(0.24, seat === 'A' ? 0.78 : 0.58), cc.rotateTo(0.24, spread * 2)), cc.fadeOut(0.12)));
    }
    this.scheduleOnce(this.finishDealAnimation.bind(this), total * delayStep + 0.42);
  },
  finishDealAnimation: function finishDealAnimation() {
    if (this.dealAnimationLayer) {
      this.dealAnimationLayer.destroy();
      this.dealAnimationLayer = null;
    }
    this.isDealing = false;
    if (this.state && this.state.hands && this.state.hands.A) {
      this.dealVisibleHandCount = this.state.hands.A.length;
    }
    this.render();
    var callbacks = this.afterDealCallbacks.slice();
    this.afterDealCallbacks.length = 0;
    if (callbacks.length) {
      this.scheduleOnce(function () {
        for (var i = 0; i < callbacks.length; i += 1) {
          callbacks[i]();
        }
      }, 0.2);
    }
  },
  makeDealCardBack: function makeDealCardBack(x, y, parent) {
    var node = this.makeNode('DealCardBack', x, y, 32, 44, parent);
    this.drawRect(node, 32, 44, cc.color(245, 248, 255, 245), 5, cc.color(232, 225, 207));
    var face = this.makeNode('DealCardFace', 0, 0, 24, 36, node);
    this.drawGlossyRect(face, 24, 36, cc.color(31, 112, 211, 235), cc.color(116, 190, 255, 120), 4, cc.color(214, 236, 255));
    return node;
  },
  makeDeck: function makeDeck() {
    var deck = [];
    for (var d = 0; d < 4; d += 1) {
      for (var s = 0; s < this.suits.length; s += 1) {
        for (var r = 0; r < this.ranks.length; r += 1) {
          var rank = this.ranks[r];
          var suit = this.suits[s];
          deck.push({
            id: d + '-' + suit + '-' + rank,
            rank: rank,
            suit: suit,
            label: rank + suit
          });
        }
      }
      deck.push({
        id: d + '-SJ',
        rank: 'SJ',
        suit: 'JOKER',
        label: '小王'
      });
      deck.push({
        id: d + '-BJ',
        rank: 'BJ',
        suit: 'JOKER',
        label: '大王'
      });
    }
    for (var i = 0; i < 4; i += 1) {
      deck.push({
        id: 'LZ-' + i,
        rank: 'LZ',
        suit: 'LZ',
        label: 'LZ'
      });
    }
    return deck;
  },
  shuffle: function shuffle(deck) {
    var copy = deck.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  },
  rankPower: function rankPower(rank) {
    if (rank === 'BJ') return 1000;
    if (rank === 'SJ') return 900;
    if (rank === 'LZ') return -1;
    if (rank === this.state.levelRank) return 800;
    if (rank === '2') return 700;
    return this.basePower[rank] || 0;
  },
  sortHand: function sortHand(hand) {
    var self = this;
    hand.sort(function (a, b) {
      return self.rankPower(a.rank) - self.rankPower(b.rank);
    });
  },
  nextSeat: function nextSeat(seat) {
    return this.seats[(this.seats.indexOf(seat) + 1) % this.seats.length];
  },
  teamOf: function teamOf(seat) {
    return seat === 'A' || seat === 'C' ? 'AC' : 'BD';
  },
  seatsOfTeam: function seatsOfTeam(team) {
    return team === 'AC' ? ['A', 'C'] : ['B', 'D'];
  },
  isActive: function isActive(seat) {
    return this.state.hands[seat].length > 0 && this.state.finished.indexOf(seat) < 0;
  },
  nextActiveSeat: function nextActiveSeat(from) {
    var cursor = this.nextSeat(from);
    for (var i = 0; i < this.seats.length; i += 1) {
      if (this.isActive(cursor)) return cursor;
      cursor = this.nextSeat(cursor);
    }
    return null;
  },
  nextLeadAfterTrick: function nextLeadAfterTrick(winner) {
    var activeSeats = [];
    for (var i = 0; i < this.seats.length; i += 1) {
      if (this.isActive(this.seats[i])) activeSeats.push(this.seats[i]);
    }
    return ShouBaYiRuleCore.nextLeadAfterTrick(winner, activeSeats);
  },
  showCatchWindTip: function showCatchWindTip(fromSeat, toSeat) {
    if (this.catchWindNode) {
      this.catchWindNode.destroy();
      this.catchWindNode = null;
    }
    var node = this.makeNode('CatchWindTip', 0, 38, 360, 170, this.root);
    node.zIndex = 950;
    this.drawRect(node, 360, 170, cc.color(10, 38, 31, 220), 24, cc.color(255, 217, 112));
    var title = this.makeLabel('车', 0, 32, 82, cc.color(255, 222, 88), node);
    title.lineHeight = 86;
    this.makeLabel(fromSeat + ' 出完无人压住，' + toSeat + ' 接风', 0, -52, 20, cc.color(255, 248, 220), node);
    this.catchWindNode = node;
    if (this.catchWindTimer) this.unschedule(this.catchWindTimer);
    this.catchWindTimer = this.hideCatchWindTip.bind(this);
    this.scheduleOnce(this.catchWindTimer, 1.05);
  },
  hideCatchWindTip: function hideCatchWindTip() {
    if (this.catchWindNode) {
      this.catchWindNode.destroy();
      this.catchWindNode = null;
    }
  },
  nextLevel: function nextLevel(rank, step) {
    var order = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    var index = order.indexOf(rank);
    return order[Math.min(order.length - 1, index + step)];
  },
  isLaizi: function isLaizi(card) {
    return card.rank === 'LZ';
  },
  groupByRank: function groupByRank(cards) {
    var groups = {};
    for (var i = 0; i < cards.length; i += 1) {
      var rank = cards[i].rank;
      if (!groups[rank]) groups[rank] = [];
      groups[rank].push(cards[i]);
    }
    return groups;
  },
  consecutiveRanks: function consecutiveRanks(orderedRanks) {
    for (var i = 1; i < orderedRanks.length; i += 1) {
      if (this.sequenceRanks.indexOf(orderedRanks[i]) !== this.sequenceRanks.indexOf(orderedRanks[i - 1]) + 1) {
        return false;
      }
    }
    return true;
  },
  analyzeCards: function analyzeCards(cards) {
    return ShouBaYiRuleCore.analyzeCards(cards, this.state.levelRank);
  },
  sortSequenceRanks: function sortSequenceRanks(a, b) {
    return this.sequenceRanks.indexOf(a) - this.sequenceRanks.indexOf(b);
  },
  validSequenceRanks: function validSequenceRanks(ordered) {
    for (var i = 0; i < ordered.length; i += 1) {
      var rank = ordered[i];
      if (this.sequenceRanks.indexOf(rank) < 0) return false;
      if (rank === this.state.levelRank) return false;
      if (rank === '2' || rank === 'SJ' || rank === 'BJ') return false;
    }
    return true;
  },
  canBeat: function canBeat(cards) {
    var previous = this.state.lastPlay ? this.state.lastPlay.analysis || this.analyzeCards(this.state.lastPlay.cards) : null;
    return ShouBaYiRuleCore.canBeatCards(cards, previous, this.state.levelRank);
  },
  canReturnSelectedTributeCard: function canReturnSelectedTributeCard(selected) {
    var pending = this.state.pendingReturns || [];
    var target = null;
    for (var i = 0; i < pending.length; i += 1) {
      if (!pending[i].returned && pending[i].receiveSeat === 'A') {
        target = pending[i];
        break;
      }
    }
    if (!target || selected.length !== 1) return false;
    var card = selected[0];
    if (card.rank === 'LZ') return false;
    if (target.tributeCard && card.id === target.tributeCard.id) return false;
    return true;
  },
  canPlaySelectedCards: function canPlaySelectedCards(selected) {
    if (this.isDealing || !this.state || this.state.current !== 'A') return false;
    if (this.state.phase === 'RETURNING_TRIBUTE') return this.canReturnSelectedTributeCard(selected);
    if (this.state.phase !== 'PLAYING' || !selected.length) return false;
    var analysis = this.analyzeCards(selected);
    return !!analysis && this.canBeat(selected);
  },
  suggestedPlayerCards: function suggestedPlayerCards() {
    if (!this.state || this.state.phase !== 'PLAYING' || this.state.current !== 'A') return [];
    return this.state.lastPlay ? this.smallestBeatGroup('A') : this.smallestLeadGroup('A');
  },
  naturalRankGroups: function naturalRankGroups(seat) {
    return ShouBaYiRuleCore.naturalRankGroups(this.state.hands[seat], this.state.levelRank);
  },
  smallestLeadGroup: function smallestLeadGroup(seat) {
    var cards = ShouBaYiRuleCore.chooseLeadCards(this.state.hands[seat], this.state.levelRank);
    if (cards.length) return cards;
    return this.forcedLeadGroup(seat);
  },
  forcedLeadGroup: function forcedLeadGroup(seat) {
    var groups = ShouBaYiRuleCore.naturalRankGroups(this.state.hands[seat], this.state.levelRank);
    for (var i = 0; i < groups.length; i += 1) {
      var group = groups[i];
      if (group[0].rank === 'BJ' || group[0].rank === 'SJ') {
        continue;
      }
      var analysis = this.analyzeCards(group);
      if (analysis && analysis.isBomb) return group;
    }
    for (var j = 0; j < groups.length; j += 1) {
      var jokerGroup = groups[j];
      var jokerAnalysis = this.analyzeCards(jokerGroup);
      if (jokerAnalysis && jokerAnalysis.valid) return jokerGroup;
    }
    return [];
  },
  smallestBeatGroup: function smallestBeatGroup(seat) {
    if (!this.state.lastPlay) return [];
    var previous = this.state.lastPlay.analysis || this.analyzeCards(this.state.lastPlay.cards);
    return ShouBaYiRuleCore.chooseFollowCards(this.state.hands[seat], previous, this.state.levelRank);
  },
  play: function play(seat, cards) {
    if (this.state.phase !== 'PLAYING') {
      this.showToast('本局已经结束');
      this.pushLog('本局已经结束，请点击“发下一局并预览进贡”。');
      return false;
    }
    if (seat !== this.state.current) {
      this.showToast('还没轮到你');
      this.pushLog('现在轮到 ' + this.state.current + '，不是 ' + seat + '。请点“电脑走到轮到我”。');
      return false;
    }
    var analysis = this.analyzeCards(cards);
    if (!analysis || !this.canBeat(cards)) {
      this.showToast(analysis ? '压不过上一手' : '这手牌不合法');
      this.pushLog(seat + ' 这手不能出：不是合法牌型，或跟牌时结构不一致/压不过上一手。');
      return false;
    }
    var ids = {};
    for (var i = 0; i < cards.length; i += 1) ids[cards[i].id] = true;
    this.state.hands[seat] = this.state.hands[seat].filter(function (card) {
      return !ids[card.id];
    });
    if (this.state.hands[seat].length === 0 && this.state.finished.indexOf(seat) < 0) {
      this.state.finished.push(seat);
      this.pushLog(seat + ' 出完了，完成顺序：' + this.state.finished.join(' > '));
    }
    this.state.lastPlay = {
      seat: seat,
      cards: cards,
      analysis: analysis
    };
    this.state.tablePlays[seat] = {
      seat: seat,
      cards: cards,
      analysis: analysis,
      origins: seat === 'A' ? this.pendingPlayerPlayOrigins : null
    };
    if (seat === 'A') this.pendingPlayerPlayOrigins = null;
    this.state.passTips = {};
    this.state.passes = [];
    this.pushLog(seat + ' 出：' + this.cardsText(cards) + '（' + analysis.label + '）');
    if (this.checkRoundEnd()) {
      this.selectedIds = {};
      this.render();
      return true;
    }
    this.state.current = this.nextActiveSeat(seat) || seat;
    this.selectedIds = {};
    this.render();
    if (seat === 'A') this.scheduleOnce(this.botToMe.bind(this), 0.35);
    return true;
  },
  pass: function pass(seat) {
    if (this.state.phase !== 'PLAYING') {
      this.showToast('本局已经结束');
      this.pushLog('本局已经结束，请点击“发下一局并预览进贡”。');
      return;
    }
    if (seat !== this.state.current) {
      this.showToast('还没轮到你');
      this.pushLog('现在轮到 ' + this.state.current + '，不是 ' + seat + '。请点“电脑走到轮到我”。');
      return;
    }
    if (!this.state.lastPlay) {
      this.showToast('首出不能不要');
      this.pushLog('首出不能不要。请出一手牌。');
      return;
    }
    this.pushLog(seat + ' 不要');
    this.state.passTips[seat] = true;
    delete this.state.tablePlays[seat];
    this.state.passes.push(seat);
    if (this.state.passes.length >= 3) {
      var winner = this.state.lastPlay.seat;
      var nextLead = this.nextLeadAfterTrick(winner);
      this.state.trickResolving = true;
      this.pushLog('一圈没人压，' + nextLead.reason);
      this.render();
      this.scheduleOnce(function () {
        this.fadeOutTablePlays();
      }.bind(this), 0.35);
      this.scheduleOnce(function () {
        this.state.lastPlay = null;
        this.state.tablePlays = {};
        this.state.passTips = {};
        this.state.passes = [];
        this.state.trickResolving = false;
        this.state.current = nextLead.seat;
        if (nextLead.catchWind) this.showCatchWindTip(nextLead.fromSeat, nextLead.seat);
        this.render();
        if (this.state.phase === 'PLAYING' && this.state.current !== 'A') this.scheduleOnce(this.botToMe.bind(this), 0.35);
      }.bind(this), 0.55);
      return;
    } else {
      this.state.current = this.nextActiveSeat(seat) || seat;
    }
    this.selectedIds = {};
    this.render();
    if (seat === 'A') this.scheduleOnce(this.botToMe.bind(this), 0.35);
  },
  botToMe: function botToMe() {
    if (!this.state || this.state.phase !== 'PLAYING' || this.state.current === 'A' || this.state.trickResolving) {
      this.render();
      return;
    }
    if (this.isBotToMeRunning) return;
    this.isBotToMeRunning = true;
    this.runBotToMeStep();
  },
  runBotToMeStep: function runBotToMeStep() {
    if (!this.state || this.state.phase !== 'PLAYING' || this.state.current === 'A' || this.state.trickResolving) {
      this.isBotToMeRunning = false;
      this.render();
      return;
    }
    var guard = 0;
    this.deferRender = true;
    while (this.state.phase === 'PLAYING' && this.state.current !== 'A' && !this.state.trickResolving && guard < 4) {
      var before = this.state.current;
      var cards = this.state.lastPlay ? this.smallestBeatGroup(before) : this.smallestLeadGroup(before);
      if (cards.length) {
        this.playBotCards(before, cards);
      } else if (this.state.lastPlay) {
        this.passBot(before);
      } else {
        this.pushLog(before + ' 没有可自动首出的合法牌。若它只剩纯癞子，按规则不能单独出癞子，预览会停在这里。');
        this.isBotToMeRunning = false;
        break;
      }
      guard += 1;
    }
    this.deferRender = false;
    this.render();
    if (this.state.phase === 'PLAYING' && this.state.current !== 'A' && !this.state.trickResolving && this.isBotToMeRunning) {
      this.scheduleOnce(this.runBotToMeStep.bind(this), 0.05);
    } else {
      this.isBotToMeRunning = false;
    }
  },
  playBotCards: function playBotCards(seat, cards) {
    var analysis = this.analyzeCards(cards);
    var ids = {};
    for (var i = 0; i < cards.length; i += 1) ids[cards[i].id] = true;
    this.state.hands[seat] = this.state.hands[seat].filter(function (card) {
      return !ids[card.id];
    });
    if (this.state.hands[seat].length === 0 && this.state.finished.indexOf(seat) < 0) {
      this.state.finished.push(seat);
      this.pushLog(seat + ' 出完了，完成顺序：' + this.state.finished.join(' > '));
    }
    this.state.lastPlay = {
      seat: seat,
      cards: cards,
      analysis: analysis
    };
    this.state.tablePlays[seat] = {
      seat: seat,
      cards: cards,
      analysis: analysis,
      origins: this.makeSeatPlayOrigins(seat, cards)
    };
    this.state.passTips = {};
    this.state.passes = [];
    this.pushLog(seat + ' 出：' + this.cardsText(cards) + '（' + analysis.label + '）');
    if (this.checkRoundEnd()) return;
    this.state.current = this.nextActiveSeat(seat) || seat;
  },
  passBot: function passBot(seat) {
    this.pushLog(seat + ' 不要');
    this.state.passTips[seat] = true;
    delete this.state.tablePlays[seat];
    this.state.passes.push(seat);
    if (this.state.passes.length >= 3) {
      var winner = this.state.lastPlay.seat;
      var nextLead = this.nextLeadAfterTrick(winner);
      this.state.trickResolving = true;
      this.pushLog('一圈没人压，' + nextLead.reason);
      this.render();
      this.scheduleOnce(function () {
        this.fadeOutTablePlays();
      }.bind(this), 0.35);
      this.scheduleOnce(function () {
        this.state.lastPlay = null;
        this.state.tablePlays = {};
        this.state.passTips = {};
        this.state.passes = [];
        this.state.trickResolving = false;
        this.state.current = nextLead.seat;
        if (nextLead.catchWind) this.showCatchWindTip(nextLead.fromSeat, nextLead.seat);
        this.render();
        if (this.state.phase === 'PLAYING' && this.state.current !== 'A') this.scheduleOnce(this.botToMe.bind(this), 0.35);
      }.bind(this), 0.55);
    } else {
      this.state.current = this.nextActiveSeat(seat) || seat;
    }
  },
  checkRoundEnd: function checkRoundEnd() {
    var firstFinishedSeat = this.state.finished[0];
    if (!firstFinishedSeat) return false;
    var winnerTeam = this.teamOf(firstFinishedSeat);
    var winnerSeats = this.seatsOfTeam(winnerTeam);
    var firstTeamComplete = this.state.finished.indexOf(winnerSeats[0]) >= 0 && this.state.finished.indexOf(winnerSeats[1]) >= 0;
    if (!firstTeamComplete && this.state.finished.length < 3) return false;
    var loserTeam = winnerTeam === 'AC' ? 'BD' : 'AC';
    var loserSeats = this.seatsOfTeam(loserTeam);
    var tributeLoserSeats = [];
    for (var i = 0; i < loserSeats.length; i += 1) {
      if (this.state.finished.indexOf(loserSeats[i]) < 0) tributeLoserSeats.push(loserSeats[i]);
    }
    var loserRemaining = tributeLoserSeats.length;
    var levelUp = loserRemaining === 2 ? 2 : loserRemaining === 1 ? 1 : 0;
    this.state.phase = 'ROUND_END';
    this.state.roundEndPending = true;
    this.state.lastResult = {
      firstFinishedSeat: firstFinishedSeat,
      finishedOrder: this.state.finished.slice(),
      winnerTeam: winnerTeam,
      loserTeam: loserTeam,
      loserRemaining: loserRemaining,
      tributeLoserSeats: tributeLoserSeats,
      levelUp: levelUp,
      nextLevelRank: this.nextLevel(this.state.levelRank, levelUp)
    };
    this.pushLog('本局结束：第一名队伍 ' + winnerTeam + ' 获胜，对方剩 ' + loserRemaining + ' 人，升 ' + levelUp + ' 级。下一局打 ' + this.state.lastResult.nextLevelRank + '。');
    this.scheduleOnce(function () {
      if (!this.state || this.state.phase !== 'ROUND_END') return;
      this.state.roundEndPending = false;
      this.state.lastPlay = null;
      this.state.tablePlays = {};
      this.state.passTips = {};
      this.state.passes = [];
      this.showRoundEndModal();
      this.render();
    }.bind(this), 0.8);
    return true;
  },
  highestNonLaizi: function highestNonLaizi(hand) {
    var list = hand.filter(function (card) {
      return card.rank !== 'LZ';
    });
    var self = this;
    list.sort(function (a, b) {
      return self.rankPower(b.rank) - self.rankPower(a.rank);
    });
    return list[0] || null;
  },
  hasPureJokers: function hasPureJokers(hand, count) {
    var big = 0;
    var small = 0;
    for (var i = 0; i < hand.length; i += 1) {
      if (hand[i].rank === 'BJ') big += 1;
      if (hand[i].rank === 'SJ') small += 1;
    }
    return big >= count || small >= count;
  },
  assessTribute: function assessTribute(result) {
    return ShouBaYiRuleCore.buildTribute(result, this.state.hands, this.state.levelRank);
  },
  tributeText: function tributeText(cards) {
    return ShouBaYiRuleCore.tributeText(cards);
  },
  onPlaySelected: function onPlaySelected() {
    if (this.isDealing) return;
    if (this.state && this.state.phase === 'RETURNING_TRIBUTE') {
      this.returnSelectedTributeCard();
      return;
    }
    var cards = [];
    var playOrigins = {};
    var hand = this.state.hands.A;
    for (var i = 0; i < hand.length; i += 1) {
      if (this.selectedIds[hand[i].id]) {
        cards.push(hand[i]);
        playOrigins[hand[i].id] = this.handCardPosition(i, hand.length);
      }
    }
    this.pendingPlayerPlayOrigins = playOrigins;
    this.play('A', cards);
  },
  onPlaySmall: function onPlaySmall() {
    if (this.isDealing) return;
    if (this.state && this.state.phase === 'RETURNING_TRIBUTE') {
      this.showToast('返牌阶段请自己选 1 张');
      return;
    }
    var cards = this.suggestedPlayerCards();
    if (cards.length) {
      this.selectedIds = {};
      for (var i = 0; i < cards.length; i += 1) {
        this.selectedIds[cards[i].id] = true;
      }
      this.pushLog('已帮你选好一手：' + this.cardsText(cards) + '。确认后点“出选中的牌”。');
      this.render();
    } else {
      this.selectedIds = {};
      this.showToast('没有可提示的牌');
      this.pushLog('暂时没有可提示的牌，可以点“不要”。');
      this.render();
    }
  },
  onPass: function onPass() {
    if (this.isDealing) return;
    if (this.state && this.state.phase === 'RETURNING_TRIBUTE') {
      this.showToast('返牌不能不要');
      return;
    }
    this.pass('A');
  },
  onBotToMe: function onBotToMe() {
    if (this.isDealing) return;
    this.botToMe();
  },
  onNextRound: function onNextRound() {
    if (!this.state.lastResult) {
      this.showToast('还没有结算');
      this.pushLog('还没有上一局结算，不能预览进贡。');
      return;
    }
    this.clearModalLayer();
    this.modalLayer.active = false;
    var previousResult = this.state.lastResult;
    var nextRank = previousResult.nextLevelRank;
    var nextStarter = previousResult.firstFinishedSeat || 'A';
    this.startRound({
      roundNumber: this.state.roundNumber + 1,
      levelRank: nextRank,
      startSeat: nextStarter,
      lastResult: previousResult,
      log: ['第 ' + (this.state.roundNumber + 1) + ' 局开始，当前打 ' + nextRank + '。上一局第一名 ' + nextStarter + ' 首出。']
    });
    this.state.tribute = this.assessTribute(previousResult);
    if (this.state.tribute && this.state.tribute.nextStarterSeat) {
      this.state.current = this.state.tribute.nextStarterSeat;
      this.state.starterSeat = this.state.tribute.nextStarterSeat;
    }
    if (this.state.tribute && this.state.tribute.summary) {
      this.pushLog(this.state.tribute.summary);
    }
    this.render();
    this.runAfterDeal(function () {
      if (this.shouldShowTributeModal(this.state.tribute)) {
        this.showTributeModal(this.state.tribute);
      } else {
        this.state.tributeResolved = true;
        this.render();
        if (this.state.phase === 'PLAYING' && this.state.current !== 'A') {
          this.scheduleOnce(this.botToMe.bind(this), 0.35);
        }
      }
    }.bind(this));
  },
  pushLog: function pushLog(text) {
    this.logLines.unshift(text);
    if (this.logLines.length > 8) this.logLines.length = 8;
    if (this.deferRender) return;
    this.render();
  },
  cardsText: function cardsText(cards) {
    var self = this;
    return cards.map(function (card) {
      return self.cardName(card);
    }).join(' ');
  },
  playerName: function playerName(seat) {
    var names = {
      A: '快乐小布丁',
      B: '星河漫步',
      C: '清风徐来',
      D: '月下独酌'
    };
    return names[seat] || seat;
  },
  playerAvatarLetter: function playerAvatarLetter(seat) {
    var letters = {
      A: '布',
      B: '星',
      C: '风',
      D: '月'
    };
    return letters[seat] || seat;
  },
  selectedCards: function selectedCards() {
    var cards = [];
    var hand = this.state.hands.A;
    for (var i = 0; i < hand.length; i += 1) {
      if (this.selectedIds[hand[i].id]) cards.push(hand[i]);
    }
    return cards;
  },
  updateCurrentAvatarPulse: function updateCurrentAvatarPulse(seat, active) {
    var seatNode = this.seatNodes && this.seatNodes[seat];
    if (!seatNode || !seatNode._avatarNode) return;
    var avatar = seatNode._avatarNode;
    var ring = seatNode._avatarPulseRing;
    var baseScale = seatNode._avatarBaseScale || 1;
    if (active) {
      if (avatar._pulseActive) return;
      avatar._pulseActive = true;
      if (ring) ring.active = true;
      avatar.stopAllActions();
      avatar.scale = baseScale;
      avatar.runAction(cc.repeatForever(cc.sequence(
        cc.scaleTo(0.45, baseScale * 1.08).easing(cc.easeSineInOut()),
        cc.scaleTo(0.45, baseScale).easing(cc.easeSineInOut())
      )));
    } else if (avatar._pulseActive) {
      avatar._pulseActive = false;
      if (ring) ring.active = false;
      avatar.stopAllActions();
      avatar.scale = baseScale;
    } else {
      if (ring) ring.active = false;
      avatar.scale = baseScale;
    }
  },
  showTurnNotice: function showTurnNotice(seat) {
    if (!this.turnNoticeNode || !this.turnNoticeLabel || !this.state || this.state.phase !== 'PLAYING') return;
    this.turnNoticeLabel.string = seat === 'A' ? '轮到你出牌' : this.playerName(seat) + ' 思考中';
    this.turnNoticeNode.stopAllActions();
    this.turnNoticeNode.active = true;
    this.turnNoticeNode.opacity = 0;
    this.turnNoticeNode.scale = 0.92;
    this.turnNoticeNode.runAction(cc.sequence(
      cc.spawn(cc.fadeIn(0.12), cc.scaleTo(0.12, 1)),
      cc.delayTime(0.55),
      cc.fadeOut(0.18),
      cc.callFunc(function () {
        this.turnNoticeNode.active = false;
      }, this)
    ));
  },
  render: function render() {
    if (!this.state) return;
    if (this.state.phase === 'PLAYING' && !this.isDealing && !this.modalLayer.active && !this.state.trickResolving && this.lastTurnNoticeSeat !== this.state.current) {
      this.lastTurnNoticeSeat = this.state.current;
      this.showTurnNotice(this.state.current);
    }
    if (this.state.phase === 'ROUND_END') {
      this.titleLabel.string = '房号 714050';
      this.subtitleLabel.string = '第 ' + this.state.roundNumber + '局';
      this.statusLabel.string = '打 ' + this.state.levelRank;
      this.actionLabel.string = this.state.lastResult.winnerTeam + '获胜';
    } else if (this.state.phase === 'RETURNING_TRIBUTE') {
      this.titleLabel.string = '房号 714050';
      this.subtitleLabel.string = '第 ' + this.state.roundNumber + '局';
      this.statusLabel.string = '打 ' + this.state.levelRank;
      this.actionLabel.string = '返牌';
    } else {
      this.titleLabel.string = '房号 714050';
      this.subtitleLabel.string = '第 ' + this.state.roundNumber + '局';
      this.statusLabel.string = '打 ' + this.state.levelRank;
      this.actionLabel.string = this.state.current === 'A' ? '轮到我*' : '轮到' + this.playerName(this.state.current);
    }
    this.levelBadge.string = '';
    if (this.teamALabel) this.teamALabel.string = 'BLUE    ' + this.state.levelRank;
    if (this.teamBLabel) this.teamBLabel.string = 'RED     ' + this.state.levelRank;
    for (var i = 0; i < this.seats.length; i += 1) {
      var seat = this.seats[i];
      var seatNode = this.seatNodes[seat];
      var isCurrent = seat === this.state.current && this.state.phase === 'PLAYING';
      var isFinished = this.state.finished.indexOf(seat) >= 0;
      var panelFill = isFinished ? cc.color(8, 28, 22, 48) : isCurrent ? cc.color(255, 235, 126, 34) : cc.color(5, 28, 22, 128);
      var panelStroke = isCurrent ? cc.color(255, 219, 96, 115) : null;
      this.drawRect(seatNode._infoPanel, seatNode._infoPanel._infoW || 170, seatNode._infoPanel._infoH || 86, panelFill, 0, panelStroke);
      this.updateCurrentAvatarPulse(seat, isCurrent && !isFinished);
      if (seatNode._avatarNode._letterLabel) {
        seatNode._avatarNode._letterLabel.string = this.playerAvatarLetter(seat);
      }
      seatNode._nameLabel.string = this.playerName(seat);
      var handCount = this.state.hands[seat].length;
      seatNode._countLabel.string = '';
      seatNode._oneCardTip.active = seat !== 'A' && !isFinished && handCount === 1;
      this.loadTeamSprite(seatNode._teamNode, this.teamOf(seat) === 'AC' ? 'ui/team-blue' : 'ui/team-red');
      seatNode._passTip.node.active = false;
    }
    if (this.state.lastPlay) {
      this.centerTitleLabel.string = '';
      this.centerLabel.string = this.playerName(this.state.lastPlay.seat) + '：' + this.state.lastPlay.analysis.label;
      this.centerTipLabel.string = this.state.current === 'A' ? '跟牌或炸弹' : this.playerName(this.state.current) + ' 思考中';
    } else if (this.state.phase === 'ROUND_END') {
      this.centerTitleLabel.string = '结算';
      this.centerLabel.string = '胜方：' + this.state.lastResult.winnerTeam + '\n升级：' + this.state.lastResult.levelUp + '\n下一局打：' + this.state.lastResult.nextLevelRank;
      this.centerTipLabel.string = '准备下一局';
    } else if (this.state.phase === 'RETURNING_TRIBUTE') {
      this.centerTitleLabel.string = '返牌';
      this.centerLabel.string = '返 1 张牌';
      this.centerTipLabel.string = '癞子不能返';
    } else if (this.state.tribute && !this.state.tributeResolved) {
      this.centerTitleLabel.string = '进贡预览';
      this.centerLabel.string = this.state.tribute.mode + '\n' + this.tributeText(this.state.tribute.cards);
      this.centerTipLabel.string = '确认后开局';
    } else {
      this.centerTitleLabel.string = '';
      this.centerLabel.string = this.state.current === 'A' ? '你先出' : this.playerName(this.state.current) + ' 先出';
      this.centerTipLabel.string = this.state.current === 'A' ? '选一手牌' : '思考中';
    }
    var playerActionVisible = !this.isDealing && !this.modalLayer.active && this.state.current === 'A' && (this.state.phase === 'PLAYING' || this.state.phase === 'RETURNING_TRIBUTE');
    var botActionVisible = !this.isDealing && !this.modalLayer.active && this.state.current !== 'A' && this.state.phase === 'PLAYING';
    var roundEndVisible = this.state.phase === 'ROUND_END' && !this.state.roundEndPending && !this.modalLayer.active && !this.isDealing;
    this.playSelectedButton.active = playerActionVisible;
    this.playSmallButton.active = playerActionVisible && this.state.phase === 'PLAYING';
    this.passButton.active = playerActionVisible && this.state.phase === 'PLAYING';
    this.botButton.active = botActionVisible;
    this.nextRoundButton.active = roundEndVisible;
    this.botButton.x = 0;
    this.nextRoundButton.x = 0;
    this.playSelectedButton.x = -224;
    this.playSmallButton.x = -52;
    this.passButton.x = 120;
    var suggestedCards = this.suggestedPlayerCards();
    this.handStatusBar.active = !this.isDealing && !this.modalLayer.active;
    this.setButtonEnabled(this.playSelectedButton, this.canPlaySelectedCards(this.selectedCards()));
    this.setButtonEnabled(this.playSmallButton, suggestedCards.length > 0);
    this.setButtonEnabled(this.passButton, !this.isDealing && this.state.current === 'A' && this.state.phase === 'PLAYING' && !!this.state.lastPlay);
    this.setButtonEnabled(this.botButton, this.state.current !== 'A' && this.state.phase === 'PLAYING' && !this.isDealing);
    this.renderTableCards();
    this.renderHand();
    this.logLabel.string = this.logLines.slice(0, 1).join('\n');
  },
  renderTableCards: function renderTableCards() {
    for (var i = 0; i < this.seats.length; i += 1) {
      var seat = this.seats[i];
      var layer = this.tablePlayLayers[seat];
      var play = this.state.tablePlays ? this.state.tablePlays[seat] : null;
      var isPass = !!(this.state.passTips && this.state.passTips[seat]);
      var signature = isPass ? seat + ':PASS' : this.tablePlaySignature(play);
      if (layer._renderedSignature === signature) continue;
      var children = layer.children.slice();
      for (var k = 0; k < children.length; k += 1) children[k].destroy();
      layer._renderedSignature = signature;
      if (isPass) {
        var passLabel = this.makeLabel('不要', 0, 0, seat === 'A' || seat === 'C' ? 26 : 22, cc.color(255, 230, 92), layer);
        passLabel.enableBold = true;
        passLabel.node.zIndex = 20;
        passLabel.node.opacity = 0;
        passLabel.node.scale = 0.86;
        passLabel.node.runAction(cc.spawn(cc.fadeIn(0.12), cc.scaleTo(0.12, 1)));
        continue;
      }
      if (!play || !play.cards.length) continue;
      var cards = play.cards;
      var width = seat === 'B' || seat === 'D' ? 44 : 48;
      var height = seat === 'B' || seat === 'D' ? 60 : 66;
      var maxSpread = seat === 'B' || seat === 'D' ? 188 : 272;
      var splitLimit = seat === 'B' || seat === 'D' ? 8 : 10;
      var useTwoRows = cards.length > splitLimit;
      var columns = useTwoRows ? Math.ceil(cards.length / 2) : cards.length;
      var rowGap = seat === 'B' || seat === 'D' ? 42 : 46;
      var gap = columns > 1 ? Math.min(32, maxSpread / (columns - 1)) : 0;
      for (var c = 0; c < cards.length; c += 1) {
        var row = useTwoRows ? Math.floor(c / columns) : 0;
        var col = useTwoRows ? c % columns : c;
        var rowCount = useTwoRows && row === 1 ? cards.length - columns : columns;
        var startX = -gap * (rowCount - 1) / 2;
        var y = useTwoRows ? rowGap / 2 - row * rowGap : 0;
        var node = this.makeCardNode(cards[c], startX + col * gap, y, width, height, {
          parent: layer,
          selectable: false,
          selectedOffset: 0,
          suitScale: 0.8
        });
        node.zIndex = row * 100 + col;
        this.animateTableCard(node, seat, c, play.origins ? play.origins[cards[c].id] : null);
      }
    }
  },
  fadeOutTablePlays: function fadeOutTablePlays() {
    if (!cc || !cc.fadeOut) return;
    for (var i = 0; i < this.seats.length; i += 1) {
      var layer = this.tablePlayLayers[this.seats[i]];
      if (!layer || !layer.children) continue;
      var children = layer.children.slice();
      for (var k = 0; k < children.length; k += 1) {
        var node = children[k];
        if (!node || !node.runAction) continue;
        node.stopAllActions();
        node.runAction(cc.fadeOut(0.18));
      }
    }
  },
  tablePlaySignature: function tablePlaySignature(play) {
    if (!play || !play.cards || !play.cards.length) return '';
    var ids = [];
    for (var i = 0; i < play.cards.length; i += 1) ids.push(play.cards[i].id);
    return play.seat + ':' + ids.join(',');
  },
  makeSeatPlayOrigins: function makeSeatPlayOrigins(seat, cards) {
    var origins = {};
    var seatNode = this.seatNodes && this.seatNodes[seat];
    var avatar = seatNode && seatNode._avatarNode;
    if (!seatNode || !avatar) return origins;
    var baseX = seatNode.x + avatar.x;
    var baseY = seatNode.y + avatar.y;
    var fan = Math.min(22, cards.length > 1 ? 80 / (cards.length - 1) : 0);
    var startX = -fan * (cards.length - 1) / 2;
    for (var i = 0; i < cards.length; i += 1) {
      origins[cards[i].id] = cc.v2(baseX + startX + i * fan, baseY);
    }
    return origins;
  },
  animateTableCard: function animateTableCard(node, seat, index, origin) {
    if (!node || !node.runAction) return;
    var targetX = node.x;
    var targetY = node.y;
    var offset = {
      A: cc.v2(0, -42),
      B: cc.v2(62, 0),
      C: cc.v2(0, 42),
      D: cc.v2(-62, 0)
    }[seat] || cc.v2(0, 0);
    node.opacity = 0;
    node.scale = 0.72;
    if (origin) {
      node.x = origin.x - this.tablePlayLayers[seat].x;
      node.y = origin.y - this.tablePlayLayers[seat].y;
      node.scale = seat === 'A' ? 0.96 : 0.68;
    } else {
      node.x = targetX + offset.x + index * 2;
      node.y = targetY + offset.y;
    }
    node.runAction(cc.sequence(
      cc.spawn(cc.fadeIn(0.14), cc.moveTo(0.2, cc.v2(targetX, targetY)).easing(cc.easeCubicActionOut()), cc.scaleTo(0.2, 1.04)),
      cc.scaleTo(0.08, 1)
    ));
  },
  handCardPosition: function handCardPosition(index, count) {
    if (false && this.isDealing) {
      this.handCountLabel.string = hand.length + ' / ' + fullHand.length;
      this.selectionLabel.string = '';
      this.hintLabel.string = '发牌中...';
    }
    var handOffsetX = 44;
    var gapX = count > 28 ? 25 : Math.min(39, 720 / Math.max(1, count - 1));
    var row = index >= 28 ? 1 : 0;
    var col = row ? index - 28 : index;
    var rowCount = row ? count - 28 : Math.min(count, 28);
    var rowStartX = row ? handOffsetX - gapX * (rowCount - 1) / 2 : handOffsetX - gapX * (Math.min(count, 28) - 1) / 2;
    var x = rowStartX + col * gapX;
    var y = 14 - row * 42;
    return cc.v2(this.handLayer.x + x, this.handLayer.y + y);
  },
  handCardAtTouch: function handCardAtTouch(touch) {
    if (!touch || !this.handHitBoxes || !this.handLayer) return null;
    var world = touch.getLocation();
    var point = this.handLayer.convertToNodeSpaceAR ? this.handLayer.convertToNodeSpaceAR(world) : world;
    for (var i = this.handHitBoxes.length - 1; i >= 0; i -= 1) {
      var box = this.handHitBoxes[i];
      if (point.x >= box.x - box.w / 2 && point.x <= box.x + box.w / 2 && point.y >= box.y - box.h / 2 && point.y <= box.y + box.h / 2) {
        return box.card;
      }
    }
    return null;
  },
  applyDragSelection: function applyDragSelection(card) {
    if (!card || !this.dragSelectState || this.dragSelectState.touched[card.id]) return;
    this.dragSelectState.touched[card.id] = true;
    if (this.dragSelectState.selecting) this.selectedIds[card.id] = true;else delete this.selectedIds[card.id];
    var box = null;
    for (var i = 0; i < this.handHitBoxes.length; i += 1) {
      if (this.handHitBoxes[i].card.id === card.id) {
        box = this.handHitBoxes[i];
        break;
      }
    }
    var node = this.handCardNodes ? this.handCardNodes[card.id] : null;
    if (box && node) {
      node.y = box.baseY + (this.selectedIds[card.id] ? box.selectedOffset : 0);
      box.y = node.y;
    }
  },
  beginHandDragSelection: function beginHandDragSelection(touch, card) {
    if (this.isDealing || !card) return;
    var targetCard = this.handCardAtTouch(touch) || card;
    this.dragSelectState = {
      selecting: !this.selectedIds[targetCard.id],
      touched: {}
    };
    this.applyDragSelection(targetCard);
  },
  moveHandDragSelection: function moveHandDragSelection(touch) {
    if (!this.dragSelectState) return;
    this.applyDragSelection(this.handCardAtTouch(touch));
  },
  endHandDragSelection: function endHandDragSelection() {
    this.dragSelectState = null;
    this.render();
  },
  renderHand: function renderHand() {
    var children = this.handLayer.children.slice();
    for (var i = 0; i < children.length; i += 1) children[i].destroy();
    this.handHitBoxes = [];
    this.handCardNodes = {};
    var fullHand = this.state.hands.A;
    var hand = this.isDealing ? fullHand.slice(0, Math.min(this.dealVisibleHandCount || 0, fullHand.length)) : fullHand;
    if (false && this.isDealing) {
      this.handCountLabel.string = hand.length + ' / ' + fullHand.length;
      this.selectionLabel.string = '';
      this.hintLabel.string = '发牌中...';
      return;
    }
    var selected = this.selectedCards();
    var selectedAnalysis = selected.length ? this.analyzeCards(selected) : null;
    this.handCountLabel.string = hand.length + ' 张牌';
    if (this.state.phase === 'RETURNING_TRIBUTE') {
      this.selectionLabel.string = selected.length ? '返牌：' + this.cardsText(selected) : '请选择 1 张返牌';
    } else if (selected.length) {
      this.selectionLabel.string = '已选 ' + selected.length + ' 张：' + (selectedAnalysis ? selectedAnalysis.label + (this.canBeat(selected) ? ' 可出' : ' 压不过') : '不成牌型');
    } else {
      this.selectionLabel.string = '未选牌';
    }
    if (this.state.phase === 'RETURNING_TRIBUTE') {
      this.hintLabel.string = '非癞子';
    } else {
      this.hintLabel.string = this.state.lastPlay ? '提示可自动选牌' : '首出可自由选择';
    }
    var cardWidth = 58;
    var cardHeight = 78;
    var handOffsetX = 44;
    var gapX = hand.length > 28 ? 25 : Math.min(39, 720 / Math.max(1, hand.length - 1));
    var startX = handOffsetX - gapX * (Math.min(hand.length, 28) - 1) / 2;
    var startY = 14;
    for (var c = 0; c < hand.length; c += 1) {
      var row = c >= 28 ? 1 : 0;
      var col = row ? c - 28 : c;
      var rowCount = row ? hand.length - 28 : Math.min(hand.length, 28);
      var rowStartX = row ? handOffsetX - gapX * (rowCount - 1) / 2 : startX;
      var x = rowStartX + col * gapX;
      var y = startY - row * 42;
      var cardNode = this.makeCardNode(hand[c], x, y, cardWidth, cardHeight, {
        selectable: !this.isDealing,
        selectedOffset: this.isDealing ? 0 : 16
      });
      cardNode.zIndex = row * 100 + col;
      this.handCardNodes[hand[c].id] = cardNode;
      this.handHitBoxes.push({
        card: hand[c],
        x: cardNode.x,
        y: cardNode.y,
        baseY: y,
        w: cardWidth,
        h: cardHeight,
        z: cardNode.zIndex,
        selectedOffset: this.isDealing ? 0 : 16
      });
    }
  },
  handCardSpritePath: function handCardSpritePath(card) {
    if (card.rank === 'LZ' || card.isLaizi) return 'ui/Hand/wild-card';
    if (card.rank === 'BJ') return 'ui/Hand/big-king';
    if (card.rank === 'SJ') return 'ui/Hand/small-king';
    var suitNames = {
      S: 'Spades',
      H: 'Hearts',
      C: 'Clubs',
      D: 'Diamonds'
    };
    return 'ui/Hand/' + card.rank + '-of-' + suitNames[card.suit];
  },
  makeCardNode: function makeCardNode(card, x, y, width, height, options) {
    var opts = options || {};
    var parent = opts.parent || this.handLayer;
    var selectable = opts.selectable !== false;
    var selectedOffset = opts.selectedOffset === undefined ? 12 : opts.selectedOffset;
    var suitScale = opts.suitScale || 1.15;
    var selected = !!this.selectedIds[card.id];
    var cardWidth = width || 62;
    var cardHeight = height || 84;
    var sizeRatio = cardHeight / 84;
    var node = this.makeNode('Card_' + card.id, x, selected && selectable ? y + selectedOffset : y, cardWidth, cardHeight, parent);
    var cardSpritePath = opts.handSpritePath || this.handCardSpritePath(card);
    if (cardSpritePath) {
      this.drawHandCardShadow(node, cardWidth, cardHeight);
      var imageNode = this.makeNode('CardImage_' + card.id, 0, 0, cardWidth, cardHeight, node);
      imageNode.zIndex = 2;
      this.loadSimpleSprite(imageNode, cardSpritePath, cardWidth, cardHeight);
      if (card.rank === this.state.levelRank) this.drawLevelCardMark(node, cardWidth, cardHeight);
      this.attachCardTouchHandlers(node, card, selectable);
      return node;
    }
    var fill = cc.color(255, 255, 255);
    var stroke = cc.color(196, 196, 196);
    this.drawPlayingCardBase(node, cardWidth, cardHeight, fill, stroke, card.rank === this.state.levelRank);
    var pixelX = function pixelX(localX) {
      return Math.round(node.x + localX) - node.x;
    };
    var pixelY = function pixelY(localY) {
      return Math.round(node.y + localY) - node.y;
    };
    if (card.rank === 'LZ') {
      var laiziLabel = this.makeLabel('LZ', pixelX(-13 * sizeRatio), pixelY(20 * sizeRatio), Math.round(24 * sizeRatio), cc.color(8, 94, 111), node);
      laiziLabel.enableBold = true;
      laiziLabel.lineHeight = 24;
      var laiziMark = this.makeLabel('癞', pixelX(12 * sizeRatio), pixelY(-8 * sizeRatio), Math.round(30 * sizeRatio), cc.color(13, 126, 148), node);
      laiziMark.enableBold = true;
      var laiziTag = this.makeLabel('万能', pixelX(-13 * sizeRatio), pixelY(-8 * sizeRatio), Math.round(10 * sizeRatio), cc.color(35, 114, 128), node);
      laiziTag.lineHeight = 12;
    } else if (card.rank === 'BJ' || card.rank === 'SJ') {
      var jokerColor = card.rank === 'BJ' ? cc.color(196, 31, 31) : cc.color(24, 36, 42);
      var jokerLabel = this.makeLabel(card.rank === 'BJ' ? '大' : '小', pixelX(-14 * sizeRatio), pixelY(20 * sizeRatio), Math.round(24 * sizeRatio), jokerColor, node);
      jokerLabel.enableBold = true;
      jokerLabel.lineHeight = 24;
      var jokerWang = this.makeLabel('王', pixelX(12 * sizeRatio), pixelY(-5 * sizeRatio), Math.round(30 * sizeRatio), jokerColor, node);
      jokerWang.enableBold = true;
      var jokerSuit = this.makeLabel(card.rank === 'BJ' ? 'JOKER' : 'joker', pixelX(-14 * sizeRatio), pixelY(-8 * sizeRatio), Math.round(10 * sizeRatio), cc.color(92, 92, 92), node);
      jokerSuit.lineHeight = 12;
    } else {
      var color = this.cardTextColor(card);
      var cornerX = -14 * sizeRatio;
      var cornerFont = Math.round((card.rank === '10' ? 28 : 30) * sizeRatio);
      var rankLabel = this.makeLabel(card.rank, pixelX(cornerX), pixelY(21 * sizeRatio), cornerFont, color, node);
      rankLabel.node.anchorX = 0.5;
      rankLabel.enableBold = true;
      rankLabel.fontFamily = 'Georgia';
      rankLabel.lineHeight = cornerFont;
      this.drawSuitIcon(node, card.suit, pixelX(cornerX), pixelY(-4 * sizeRatio), color, suitScale * 0.62 * sizeRatio);
      if (card.rank === this.state.levelRank) {
        var starLabel = this.makeLabel('★', pixelX(10 * sizeRatio), pixelY(31 * sizeRatio), Math.round(9 * sizeRatio), cc.color(181, 119, 14), node);
        starLabel.enableBold = true;
        starLabel.lineHeight = 12;
      }
    }
    this.attachCardTouchHandlers(node, card, selectable);
    return node;
  },
  drawHandCardShadow: function drawHandCardShadow(node, width, height) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    var radius = Math.max(5, Math.round(width * 0.08));
    graphics.clear();
    graphics.fillColor = cc.color(0, 0, 0, 18);
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 1, -height / 2 - 2, width, height, radius);
    } else {
      graphics.rect(-width / 2 + 1, -height / 2 - 2, width, height);
    }
    graphics.fill();
    graphics.fillColor = cc.color(0, 0, 0, 12);
    graphics.rect(-width / 2 + 8, -height / 2 - 1, width - 16, 2);
    graphics.fill();
  },
  drawLevelCardMark: function drawLevelCardMark(node, width, height) {
    var mark = this.makeNode('LevelCardMark', 0, 0, width, height, node);
    mark.zIndex = 4;
    var graphics = mark.addComponent(cc.Graphics);
    var radius = Math.max(5, Math.round(width * 0.08));
    graphics.strokeColor = cc.color(255, 203, 54, 210);
    graphics.lineWidth = 2;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, radius);
    } else {
      graphics.rect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);
    }
    graphics.stroke();
    var star = this.makeLabel('★', -width / 2 + 9, -height / 2 + 10, Math.max(9, Math.round(width * 0.18)), cc.color(255, 196, 42), mark);
    star.enableBold = true;
    star.lineHeight = Math.max(10, Math.round(width * 0.2));
    star.node.zIndex = 2;
  },
  attachCardTouchHandlers: function attachCardTouchHandlers(node, card, selectable) {
    if (!selectable) return;
    node.on(cc.Node.EventType.TOUCH_START, function (event) {
      this.beginHandDragSelection(event, card);
    }, this);
    node.on(cc.Node.EventType.TOUCH_MOVE, function (event) {
      this.moveHandDragSelection(event);
    }, this);
    node.on(cc.Node.EventType.TOUCH_END, function () {
      this.endHandDragSelection();
    }, this);
    node.on(cc.Node.EventType.TOUCH_CANCEL, function () {
      this.endHandDragSelection();
    }, this);
  },
  drawPlayingCardBase: function drawPlayingCardBase(node, width, height, fill, strokeColor, isLevel) {
    var graphics = node.getComponent(cc.Graphics) || node.addComponent(cc.Graphics);
    var radius = Math.max(5, Math.round(width * 0.08));
    graphics.clear();
    graphics.fillColor = cc.color(0, 0, 0, 34);
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 1, -height / 2 - 2, width, height, radius);
    } else {
      graphics.rect(-width / 2 + 1, -height / 2 - 2, width, height);
    }
    graphics.fill();
    graphics.fillColor = fill;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    } else {
      graphics.rect(-width / 2, -height / 2, width, height);
    }
    graphics.fill();
    graphics.strokeColor = strokeColor;
    graphics.lineWidth = 1;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, radius);
    } else {
      graphics.rect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
    }
    graphics.stroke();
    graphics.strokeColor = cc.color(238, 238, 238, 110);
    graphics.lineWidth = 1;
    if (graphics.roundRect) {
      graphics.roundRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, Math.max(3, radius - 3));
    } else {
      graphics.rect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10);
    }
    graphics.stroke();
  },
  makeOneCardTip: function makeOneCardTip(x, y, parent) {
    var node = this.makeNode('OneCardTip', x, y, 30, 43, parent);
    node.zIndex = 20;
    this.loadSimpleSprite(node, 'ui/puke', 30, 43);
    var label = this.makeLabel('1', 0, 0, 18, cc.color(255, 250, 218), node);
    label.enableBold = true;
    label.node.zIndex = 5;
    return node;
  },
  cardName: function cardName(card) {
    if (card.rank === 'LZ') return 'LZ';
    if (card.rank === 'BJ' || card.rank === 'SJ') return card.label;
    return card.rank + this.suitShortName(card.suit);
  },
  suitShortName: function suitShortName(suit) {
    if (suit === 'S') return '黑';
    if (suit === 'H') return '红';
    if (suit === 'C') return '梅';
    if (suit === 'D') return '方';
    return '';
  },
  cardTextColor: function cardTextColor(card) {
    if (card.rank === 'LZ') return cc.color(20, 112, 128);
    if (card.rank === 'BJ' || card.rank === 'SJ') return cc.color(28, 28, 28);
    if (card.suit === 'H' || card.suit === 'D') return cc.color(204, 28, 25);
    return cc.color(22, 24, 38);
  },
  drawSuitIcon: function drawSuitIcon(parent, suit, x, y, color, scale) {
    var size = scale || 1;
    var icon = this.makeNode('Suit_' + suit, x, y, 24 * size, 24 * size, parent);
    var graphics = icon.addComponent(cc.Graphics);
    graphics.fillColor = color;
    graphics.strokeColor = color;
    graphics.lineWidth = 2;
    if (suit === 'H') {
      graphics.circle(-5 * size, 4 * size, 6 * size);
      graphics.circle(5 * size, 4 * size, 6 * size);
      graphics.moveTo(-11 * size, 2 * size);
      graphics.lineTo(0, -12 * size);
      graphics.lineTo(11 * size, 2 * size);
      graphics.fill();
      return;
    }
    if (suit === 'D') {
      graphics.moveTo(0, 13 * size);
      graphics.lineTo(10 * size, 0);
      graphics.lineTo(0, -13 * size);
      graphics.lineTo(-10 * size, 0);
      graphics.close();
      graphics.fill();
      return;
    }
    if (suit === 'S') {
      graphics.circle(-5 * size, -1 * size, 6 * size);
      graphics.circle(5 * size, -1 * size, 6 * size);
      graphics.moveTo(0, 13 * size);
      graphics.lineTo(-11 * size, -1 * size);
      graphics.lineTo(11 * size, -1 * size);
      graphics.close();
      graphics.fill();
      graphics.rect(-2 * size, -12 * size, 4 * size, 10 * size);
      graphics.fill();
      return;
    }
    if (suit === 'C') {
      graphics.circle(0, 6 * size, 6 * size);
      graphics.circle(-6 * size, -2 * size, 6 * size);
      graphics.circle(6 * size, -2 * size, 6 * size);
      graphics.fill();
      graphics.rect(-2 * size, -13 * size, 4 * size, 10 * size);
      graphics.fill();
    }
  }
});
cc._RF.pop();

cc._RF.pop();
