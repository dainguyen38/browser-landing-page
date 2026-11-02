# Tiến lên miền Nam — offline

Luật đánh bài theo phần I của `TLMN_GAME_SPEC.md` v1.0, profile `TLMN_OFFLINE_V1`.
Yêu cầu mới thay điểm phiên bằng cược d-coin cố định và thêm đồng hồ lượt.

- Bàn 4 cạnh, 4 ghế × 13 lá. Avatar người cầm bài nằm bên trái tay bài; ghế của họ không lặp lại trên bàn. Chọn 1–4 người chung máy, ghế còn lại là bot Cơ bản/Trung bình.
- 12 ảnh chân dung người mẫu lưu cục bộ; username bot và avatar được ghép ngẫu nhiên khi tạo bàn, giữ qua các ván tiếp theo. Nguồn ảnh trong `public/assets/tlmn/avatars/README.md`.
- Bot suy nghĩ ngẫu nhiên 1,3–2,5 giây mỗi lượt.
- Mỗi ghế có chồng bài úp và số lá còn lại. Bài đánh bay từ cạnh ghế đó về giữa bàn, tắt chuyển động khi bật reduced motion.
- Ván đầu mở bằng bộ có 3♠. Ván sau người thắng mở. Người đầu hết bài kết thúc ngay.
- Hỗ trợ lẻ, đôi, sám, sảnh, tứ quý, 3/4 đôi thông, chặt đúng lượt. PASS khóa đến vòng mới. Cho về bằng 2, không chặt ngoài lượt/đền làng.
- Chia từng lá theo chiều lượt: 52 lá trong khoảng 3,6 giây, kèm âm thanh lướt bài tổng hợp bằng Web Audio. Không mở bài, chạy bot hay bắt đầu countdown trước khi chia xong. Có nút tắt tiếng; animation/âm thanh dừng khi pause và được dọn khi đóng popup. Trình duyệt yêu cầu thao tác người dùng trước khi bật âm thanh.
- Khi chặn bài, chọn một lá sẽ tự chọn thêm nếu chỉ còn đúng một bộ hợp lệ chứa tất cả lá đã chọn. Có nhiều phương án thì để người dùng chọn; bấm lá đã chọn để bỏ chọn.
- Mỗi lượt 30 giây, tính cả bàn giao máy. Cảnh báo vòng đếm ngược trong 5 giây cuối. Hết giờ tự PASS; nếu mở vòng thì đánh lẻ hợp lệ nhỏ nhất để không kẹt bàn.
- Đồng hồ và bot dừng khi pause/đóng popup. Về trang chủ/xem luật trong popup không né được lượt. Sau khi tải lại trang, ván tiếp tục với đồng hồ mới cho lượt đó.
- Hot-seat không render bài trên tay khi bàn giao; người nhận xác nhận để mở. Bot chỉ nhận tay mình và thông tin công khai.

## d-coin

- Ví của bạn và ba ví khách: mỗi ví khởi tạo 1.000.000 d-coin. Ví gắn với vị trí người chơi cục bộ, không gắn với tên nhập.
- Nhập `Việt Nam vô địch` tại widget hoặc trang chủ game để nhận 1.000.000 vào ví được chọn. Chấp nhận Unicode tương đương, khoảng trắng và khác hoa/thường. Có thể nhận nhiều lần theo yêu cầu.
- Mỗi ghế cược 1.000 / 10.000 / 50.000 / 100.000; mặc định 10.000. Trừ trước khi chia, người thắng nhận cả bốn phần cược (lãi ròng ba phần). Không thu thêm cho cóng/thối/chặt. Các tình huống này vẫn được ghi nhận trong kết quả; trọng số luật cũ chỉ phục vụ chẩn đoán engine, không dùng thanh toán.
- Ví bot là số dư mô phỏng, tự bổ sung vốn nếu không đủ vào ván kế tiếp. Không nạp thêm cho ví người chơi nếu chưa nhập câu nhận coin.
- Kết quả hiện qua popup, mỗi người chỉ có tên/avatar và tiền nhận về (người thắng nhận pot, người còn lại 0); không có bảng các cột cược/số dư ở dưới bàn.
- Có thể hủy ván offline chưa kết thúc, kể cả đang chia hoặc đã đánh. Hoàn lại đúng cược cho bốn ghế một lần, xóa ván đang giữ; tác vụ cũ không thể tiếp tục đánh hay hoàn tiền thêm. Ván đã thanh toán không thể hủy. Chưa có phòng online hay chức năng rời phòng mạng.
- Không bắt đầu cược mới khi còn ván chưa kết thúc. Ván và phần cược được lưu cùng giao dịch LocalStorage. Payout chỉ được ghi một lần; action cũ/khác ván không thể trả thưởng lại.
- Lưu ví, ván đang chơi (bao gồm tay bài cục bộ) và cấu hình trên máy; tải lại vẫn tiếp tục được cược đang giữ. Hot-seat bảo vệ phần hiển thị, không giấu dữ liệu khỏi DevTools.
- Coin ảo, không có quy đổi tiền thật, tài khoản hay backend. Không cần mạng cho gameplay sau khi tài nguyên đã tải; chưa có service worker cho lần mở mới offline.

## Kiểm tra

`npm run test:minigame` và `npm run build`.

Core/bot: tổ hợp, ma trận chặt, tới trắng, vòng PASS, ghi nhận cóng/thối, trợ chọn, hết giờ và chơi liên tiếp.
Ví: nhận coin, trừ cược, không đủ coin, trả thưởng một lần, hủy/hoàn cược, tới trắng, chống action trùng và khôi phục LocalStorage.
React server render: che bài 1/2/4 người, bốn ghế/avatar/chồng bài/timer và nội dung tiền nhận về dùng trong popup kết quả. Số dư thực tế/khôi phục được kiểm tra riêng ở test store vì Zustand server render dùng initial snapshot.
Chưa thay thế kiểm thử tương tác E2E trên trình duyệt hoặc kiểm tra bố cục/animation trên điện thoại thật.
