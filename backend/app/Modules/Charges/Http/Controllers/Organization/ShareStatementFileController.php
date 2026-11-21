<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\ShareStatementFile;
use App\Modules\Charges\Http\Requests\ShareFileRequest;
use App\Modules\Charges\Http\Resources\StatementResource;
use App\Modules\Charges\Queries\Statements;

final class ShareStatementFileController
{
    public function __invoke(string $statement, string $file, ShareFileRequest $request, ShareStatementFile $partager, Statements $decomptes): StatementResource
    {
        $partager->handle($statement, $file, $request->visible());
        $d = $decomptes->get($statement);

        return new StatementResource($d, $decomptes->lines($d), $decomptes->files($d), $decomptes->plan($d));
    }
}
