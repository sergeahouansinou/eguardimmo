<?php

declare(strict_types=1);

use App\Shared\Http\ApiProblem;
use App\Shared\Http\AssignRequestId;
use App\Shared\Http\ProblemRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withEvents(discover: glob(__DIR__.'/../app/Modules/*/Listeners', GLOB_ONLYDIR) ?: [])
    ->withMiddleware(function (Middleware $middleware): void {
        // API pure : pas de page de connexion, un invité reçoit un 401 JSON et non une redirection.
        $middleware->prepend(AssignRequestId::class);
        $middleware->redirectGuestsTo(fn (): ?string => null);
        $middleware->statefulApi();
        $middleware->authenticateSessions();
        // Apple rappelle en POST cross-site : le state chiffré à usage unique et le cookie binder remplacent le jeton CSRF.
        $middleware->preventRequestForgery(except: ['auth/social/*/callback']);
        $middleware->throttleApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (): bool => true);
        $exceptions->dontReportWhen(fn (Throwable $e): bool => $e instanceof ApiProblem && $e->status < 500);
        $exceptions->render(new ProblemRenderer);
    })->create();
