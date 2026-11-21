<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ErrorCode;
use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * Verrou applicatif réentrant : sérialise les opérations qui comptent des lignes avant d'en écrire (plafonds par fiche ou par compte),
 * là où le verrou de ligne de la base ne suffit pas (verrou d'intervalle, interblocage MySQL). Attente de 3 secondes au plus, puis 409
 * `conversation_busy` : jamais une 500.
 */
final class OperationLocks
{
    public const int ATTENTE_SECONDES = 3;

    public const int DUREE_SECONDES = 30;

    /** @var array<string, true> */
    private array $tenus = [];

    /**
     * @template T
     *
     * @param  Closure(): T  $appel
     * @return T
     */
    public function run(string $cle, Closure $appel): mixed
    {
        if (isset($this->tenus[$cle])) {
            return $appel();
        }

        $verrou = Cache::lock('messaging:'.$cle, self::DUREE_SECONDES);

        try {
            $verrou->block(self::ATTENTE_SECONDES);
        } catch (LockTimeoutException) {
            throw ErrorCode::ConversationBusy->problem();
        }

        $this->tenus[$cle] = true;

        try {
            return $appel();
        } finally {
            unset($this->tenus[$cle]);
            $verrou->release();
        }
    }
}
