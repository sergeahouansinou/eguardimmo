<?php

declare(strict_types=1);

namespace App\Shared\Approval;

use RuntimeException;

/**
 * Levée par un exécuteur quand l'état du sujet a changé depuis la demande : rien n'est écrit, la demande passe en échec.
 */
final class ApprovalStale extends RuntimeException {}
