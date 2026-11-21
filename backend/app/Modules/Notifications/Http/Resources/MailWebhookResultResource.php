<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{processed: int, duplicates: int, ignored: int} $resource
 */
final class MailWebhookResultResource extends JsonResource
{
    /**
     * @return array<string, int>
     */
    public function toArray(Request $request): array
    {
        return ['processed' => $this->resource['processed'], 'duplicates' => $this->resource['duplicates'], 'ignored' => $this->resource['ignored']];
    }
}
