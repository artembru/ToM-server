import { type TwakeLogger } from '@twake/logger'
import { type NextFunction, type Request, type Response } from 'express'
import errorMiddleware from './error.middleware'

describe('Error middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  const mockLogger: Partial<TwakeLogger> = {
    error: jest.fn()
  }
  let errorMock: (
    error: Error & { status?: number },
    req: Request,
    res: Response,
    next: NextFunction
  ) => void

  const nextFunction: NextFunction = jest.fn()

  beforeEach(() => {
    mockRequest = {}
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }

    errorMock = errorMiddleware(mockLogger as TwakeLogger)
  })

  it('should return the specified error message', () => {
    const expectedErrorResponse = {
      message: 'Error message'
    }

    errorMock(
      { message: 'Error message', name: 'some error', status: 123 },
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    expect(mockResponse.json).toHaveBeenCalledWith(expectedErrorResponse)
  })

  it('should default to a 500 generic error when no error is specified', () => {
    const expectedErrorResponse = {
      message: 'Something went wrong'
    }

    errorMock(
      { name: 'idk' } as unknown as Error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledWith(expectedErrorResponse)
  })

  it('should call the next handler when something wrong happens', () => {
    mockResponse.status = () => {
      throw Error('something unexpected')
    }

    errorMock(
      { name: 'idk' } as unknown as Error,
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    )

    expect(nextFunction).toHaveBeenCalled()
  })
})
