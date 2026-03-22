const Reservation = require('../models/Reservation');
const Shop = require('../models/Shop');

const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const isPastDate = (dateValue) => {
    const reserveDateOnly = new Date(dateValue);
    reserveDateOnly.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return reserveDateOnly < today;
};

//@desc   Get all reservations
//@route  GET /api/v1/reservations
//@access Private
exports.getReservations = async (req, res, next) => {
    let query;

    if (req.user.role !== 'admin') {
        query = Reservation.find({ user: req.user.id })
            .populate({
                path: 'shop',
                select: 'name tel openTime closeTime'
            })
            .populate({
                path: 'user',
                select: 'name email role telephone'
            });
    } else {
        if (req.params.shopId) {
            query = Reservation.find({ shop: req.params.shopId })
                .populate({
                    path: 'shop',
                    select: 'name tel openTime closeTime'
                })
                .populate({
                    path: 'user',
                    select: 'name email role telephone'
                });
        } else {
            query = Reservation.find()
                .populate({
                    path: 'shop',
                    select: 'name tel openTime closeTime'
                })
                .populate({
                    path: 'user',
                    select: 'name email role telephone'
                });
        }
    }

    try {
        const reservations = await query;
        res.status(200).json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (err) {
        console.log(err.stack);
        return res.status(500).json({
            success: false,
            message: "Cannot find Reservation"
        });
    }
};

//@desc   Get single reservation
//@route  GET /api/v1/reservations/:id
//@access Private
exports.getReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
            .populate({
                path: 'shop',
                select: 'name tel openTime closeTime'
            })
            .populate({
                path: 'user',
                select: 'name email role telephone'
            });

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }

        if (
            reservation.user._id.toString() !== req.user.id &&
            req.user.role !== 'admin'
        ) {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to view this reservation`
            });
        }

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (err) {
        console.log(err.stack);
        return res.status(500).json({
            success: false,
            message: "Cannot find Reservation"
        });
    }
};

//@desc   Add reservation
//@route  POST /api/v1/shops/:shopId/reservations
//@access Private
exports.addReservation = async (req, res, next) => {
    try {
        req.body.shop = req.params.shopId;

        const shop = await Shop.findById(req.params.shopId);

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: `No shop with the id of ${req.params.shopId}`
            });
        }

        req.body.user = req.user.id;

        if (isPastDate(req.body.reserveDate)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reserve past date'
            });
        }

        const reserveMin = toMin(req.body.reserveTime);
        const openMin = toMin(shop.openTime);
        const closeMin = toMin(shop.closeTime);

        if (reserveMin < openMin || reserveMin > closeMin) {
            return res.status(400).json({
                success: false,
                message: 'Shop is closed at this time'
            });
        }

        const existedReservations = await Reservation.find({ user: req.user.id });

        if (existedReservations.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: `The user with ID ${req.user.id} has already made 3 reservations`
            });
        }

        const reservation = await Reservation.create(req.body);

        const populatedReservation = await Reservation.findById(reservation._id)
            .populate({
                path: 'shop',
                select: 'name tel openTime closeTime'
            })
            .populate({
                path: 'user',
                select: 'name email role telephone'
            });

        res.status(200).json({
            success: true,
            data: populatedReservation
        });
    } catch (err) {
        console.log(err.stack);
        return res.status(500).json({
            success: false,
            message: "Cannot create Reservation"
        });
    }
};

//@desc   Update reservation
//@route  PUT /api/v1/reservations/:id
//@access Private
exports.updateReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }

        if (
            reservation.user.toString() !== req.user.id &&
            req.user.role !== 'admin'
        ) {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to update this reservation`
            });
        }

        const targetShopId = req.body.shop || reservation.shop;
        const shop = await Shop.findById(targetShopId);

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: `No shop with the id of ${targetShopId}`
            });
        }

        const updatedReserveDate = req.body.reserveDate || reservation.reserveDate;
        const updatedReserveTime = req.body.reserveTime || reservation.reserveTime;

        if (isPastDate(updatedReserveDate)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reserve past date'
            });
        }

        const reserveMin = toMin(updatedReserveTime);
        const openMin = toMin(shop.openTime);
        const closeMin = toMin(shop.closeTime);

        if (reserveMin < openMin || reserveMin > closeMin) {
            return res.status(400).json({
                success: false,
                message: 'Shop is closed at this time'
            });
        }

        reservation = await Reservation.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        )
            .populate({
                path: 'shop',
                select: 'name tel openTime closeTime'
            })
            .populate({
                path: 'user',
                select: 'name email role telephone'
            });

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (err) {
        console.log(err.stack);
        return res.status(500).json({
            success: false,
            message: "Cannot update Reservation"
        });
    }
};

//@desc   Delete reservation
//@route  DELETE /api/v1/reservations/:id
//@access Private
exports.deleteReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: `No reservation with the id of ${req.params.id}`
            });
        }

        if (
            reservation.user.toString() !== req.user.id &&
            req.user.role !== 'admin'
        ) {
            return res.status(401).json({
                success: false,
                message: `User ${req.user.id} is not authorized to delete this reservation`
            });
        }

        await reservation.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.log(err.stack);
        return res.status(500).json({
            success: false,
            message: "Cannot delete Reservation"
        });
    }
};