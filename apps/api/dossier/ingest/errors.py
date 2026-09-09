class UnreadablePdfError(ValueError):
    error_code = "unreadable_pdf"


class UnsupportedTypeError(ValueError):
    error_code = "unsupported_type"


class TooLargeError(ValueError):
    error_code = "too_large"


class DecodeError(ValueError):
    error_code = "invalid_encoding"


class UnreadableImageError(ValueError):
    error_code = "unreadable_image"


class VisionError(ValueError):
    error_code = "vision_failed"


class ModelMismatchError(ValueError):
    error_code = "model_mismatch"
