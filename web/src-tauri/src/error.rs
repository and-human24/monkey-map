pub fn map_internal_err(context: &str, e: impl std::fmt::Display) -> String {
    log::error!("{}: {}", context, e);
    format!("Operation failed: {}", context)
}
