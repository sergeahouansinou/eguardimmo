<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Identity\PublicApi\ReauthenticationMethods;
use App\Modules\Leases\Data\ProofContext;
use Illuminate\Http\Request;

final readonly class ProofContexts
{
    public function __construct(private ReauthenticationMethods $methodes) {}

    public function of(Request $request): ProofContext
    {
        return new ProofContext($request->ip(), $request->userAgent(), $request->hasSession() ? $this->methodes->of($request) : null);
    }
}
