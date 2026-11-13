<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ProblemRenderer
{
    public const CONTENT_TYPE = 'application/problem+json';

    /**
     * @var array<int, array{string, string, string}>
     */
    private const STANDARDS = [
        400 => ['bad_request', 'Requête invalide', 'La requête est mal formée.'],
        401 => ['unauthenticated', 'Non authentifié', 'Connectez-vous pour continuer.'],
        403 => ['forbidden', 'Accès refusé', 'Vous n\'avez pas accès à cette ressource.'],
        404 => ['not_found', 'Introuvable', 'La ressource demandée est introuvable.'],
        405 => ['method_not_allowed', 'Méthode non autorisée', 'Cette méthode n\'est pas autorisée sur cette ressource.'],
        409 => ['conflict', 'Conflit', 'La demande est en conflit avec l\'état actuel de la ressource.'],
        419 => ['csrf_token_mismatch', 'Session expirée', 'Votre session a expiré. Rechargez la page.'],
        422 => ['validation_failed', 'Données invalides', 'Certaines informations sont invalides.'],
        429 => ['too_many_requests', 'Trop de tentatives', 'Trop de tentatives. Réessayez plus tard.'],
        503 => ['service_unavailable', 'Service indisponible', 'Le service est momentanément indisponible. Réessayez plus tard.'],
    ];

    private const CLIENT = ['http_error', 'Requête refusée', 'La requête ne peut pas aboutir.'];

    private const SERVEUR = ['server_error', 'Erreur interne', 'Une erreur interne est survenue. Réessayez plus tard.'];

    private ?Request $request = null;

    public function __invoke(Throwable $e, Request $request): ?JsonResponse
    {
        $this->request = $request;

        return match (true) {
            $e instanceof HttpResponseException => null,
            $e instanceof ApiProblem => $this->reponse($e->problemCode, $e->status, $e->title, $e->getMessage(), $e->headers),
            $e instanceof ValidationException => $this->standard($e->status, [], ['errors' => $e->errors()]),
            $e instanceof AuthenticationException => $this->standard(401),
            $e instanceof HttpExceptionInterface => $this->standard($e->getStatusCode(), $e->getHeaders()),
            default => $this->standard(500),
        };
    }

    /**
     * @param  array<string, mixed>  $entetes
     * @param  array<string, mixed>  $extensions
     */
    private function standard(int $statut, array $entetes = [], array $extensions = []): JsonResponse
    {
        [$code, $titre, $detail] = self::STANDARDS[$statut] ?? ($statut >= 500 ? self::SERVEUR : self::CLIENT);

        return $this->reponse($code, $statut, $titre, $detail, $entetes, $extensions);
    }

    /**
     * @param  array<string, mixed>  $entetes
     * @param  array<string, mixed>  $extensions
     */
    private function reponse(string $code, int $statut, string $titre, string $detail, array $entetes, array $extensions = []): JsonResponse
    {
        $corps = [
            'type' => rtrim((string) config('app.url'), '/').'/problems/'.$code,
            'title' => $titre,
            'status' => $statut,
            'detail' => $detail,
            'code' => $code,
            ...$extensions,
        ];

        $identifiant = $this->request?->attributes->get(AssignRequestId::ATTRIBUT);

        if (is_string($identifiant)) {
            $corps['request_id'] = $identifiant;
        }

        $attente = $entetes['Retry-After'] ?? null;

        if (is_numeric($attente)) {
            $corps['retry_after'] = (int) $attente;
        }

        return new JsonResponse($corps, $statut, [...$entetes, 'Content-Type' => self::CONTENT_TYPE]);
    }
}
