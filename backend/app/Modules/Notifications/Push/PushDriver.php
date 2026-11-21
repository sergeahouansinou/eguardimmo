<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Push;

use App\Modules\Notifications\Data\PushMessage;
use App\Modules\Notifications\Enums\PushResult;

/**
 * Jamais d'exception : un échec est un résultat, le push ne bloque rien (ADR 0027).
 */
interface PushDriver
{
    public function send(#[\SensitiveParameter] string $deviceToken, PushMessage $message): PushResult;
}
