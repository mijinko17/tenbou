export class AppError extends Error {
	constructor(
		message: string,
		public readonly status: 400 | 404 | 409 | 422 = 422,
	) {
		super(message);
		this.name = "AppError";
	}
}
