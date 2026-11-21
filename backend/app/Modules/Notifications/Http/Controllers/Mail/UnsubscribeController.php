<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Mail;

use App\Modules\Notifications\Actions\PreviewUnsubscription;
use App\Modules\Notifications\Actions\UnsubscribeRecipient;
use App\Modules\Notifications\Support\UnsubscribePage;
use App\Shared\Http\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Désinscription en un clic : POST du client de messagerie (RFC 8058, 204) ou du bouton de la page (réponse HTML).
 */
final class UnsubscribeController
{
    public function __invoke(Request $request, string $token, PreviewUnsubscription $apercu, UnsubscribeRecipient $action): Response
    {
        $navigateur = $request->acceptsHtml() && ! $request->expectsJson();

        try {
            $action->handle($token);
        } catch (ApiProblem $probleme) {
            return $navigateur ? UnsubscribePage::render('invalid', '', 404) : throw $probleme;
        }

        return $navigateur ? UnsubscribePage::render('done', $apercu->handle($token)) : new Response(null, 204);
    }
}
