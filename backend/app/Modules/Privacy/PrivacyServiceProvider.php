<?php

declare(strict_types=1);

namespace App\Modules\Privacy;

use App\Modules\Privacy\Console\FlagDueRequestsCommand;
use App\Modules\Privacy\Console\PurgeExportsCommand;
use App\Modules\Privacy\Http\Middleware\PrivateResponse;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Models\PrivacyRequestEvent;
use App\Modules\Privacy\Models\PrivacyRequestForward;
use App\Modules\Privacy\Support\PrivacyApprovalHandlers;
use App\Shared\Approval\ApprovalHandlers;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class PrivacyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'privacy_request' => PrivacyRequest::class,
            'privacy_request_event' => PrivacyRequestEvent::class,
            'privacy_request_forward' => PrivacyRequestForward::class,
        ]);

        /** @var Router $routeur */
        $routeur = $this->app->make(Router::class);
        $routeur->aliasMiddleware('privacy.private', PrivateResponse::class);

        $this->app->make(PrivacyApprovalHandlers::class)->register($this->app->make(ApprovalHandlers::class));

        if ($this->app->runningInConsole()) {
            $this->commands([FlagDueRequestsCommand::class, PurgeExportsCommand::class]);
        }
    }
}
