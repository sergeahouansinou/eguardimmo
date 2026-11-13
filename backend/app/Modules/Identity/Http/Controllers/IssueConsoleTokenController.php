<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\IssueConsoleToken;
use App\Modules\Identity\Http\Requests\ConsoleTokenRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

final class IssueConsoleTokenController
{
    public function __invoke(ConsoleTokenRequest $request, IssueConsoleToken $console): JsonResponse
    {
        $jeton = $console->handle(
            (string) $request->string('email'),
            (string) $request->string('password'),
            $request->code(),
            $request->recoveryCode(),
        );

        if ($jeton === null) {
            throw ValidationException::withMessages(['email' => [__('auth.failed')]]);
        }

        return new JsonResponse(['data' => ['token' => $jeton]], 201);
    }
}
