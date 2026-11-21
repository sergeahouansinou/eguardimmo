<?php

declare(strict_types=1);

namespace App\Shared\Approval;

use Closure;
use LogicException;

/**
 * Registre des actions à double validation (ADR 0037, décision 4) : le module qui possède l'action y enregistre comment valider une
 * demande et comment l'exécuter. Operations n'importe aucun module.
 */
final class ApprovalHandlers
{
    /** @var (Closure(string, string): bool)|null */
    private ?Closure $pending = null;

    /** @var array<string, array{prepare: Closure(string, array<string, mixed>): ApprovalSubject, execute: Closure(ApprovalExecution): void}> */
    private array $handlers = [];

    /**
     * @param  Closure(string, array<string, mixed>): ApprovalSubject  $prepare  (identifiant du sujet, charge brute) ; lève ApiProblem ou ValidationException
     * @param  Closure(ApprovalExecution): void  $execute  relit l'état sous verrou ; lève ApprovalStale si le sujet a changé
     */
    public function register(string $action, Closure $prepare, Closure $execute): void
    {
        $this->handlers[$action] = ['prepare' => $prepare, 'execute' => $execute];
    }

    /**
     * @param  Closure(string, string): bool  $resolver  (action, identifiant du sujet) : une demande vivante existe-t-elle ?
     */
    public function resolvePending(Closure $resolver): void
    {
        $this->pending = $resolver;
    }

    public function hasPending(string $action, string $subjectId): bool
    {
        return ($this->pending ?? throw new LogicException('Aucun résolveur de demandes en attente enregistré.'))($action, strtolower($subjectId));
    }

    public function has(string $action): bool
    {
        return isset($this->handlers[$action]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function prepare(string $action, string $subjectId, array $payload): ApprovalSubject
    {
        return ($this->handlers[$action] ?? throw new LogicException("Action à double validation sans exécuteur : {$action}."))['prepare']($subjectId, $payload);
    }

    public function execute(ApprovalExecution $execution): void
    {
        ($this->handlers[$execution->action] ?? throw new LogicException("Action à double validation sans exécuteur : {$execution->action}."))['execute']($execution);
    }
}
