/**
 * Transforms an error object (throwable) into a human-readable message.
 * @param error 
 * @returns 
 */
export function errMsg(error: any): string {
    if (typeof error ==='string') {
        return error;
    } else if (error instanceof Error) {
        return error.message;
    } else {
        return '' + error;
    }
}
